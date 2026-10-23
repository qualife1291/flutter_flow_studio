import 'ast_pipeline.dart';
import 'dart:convert';
import 'dart:io';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:path/path.dart' as p;
import 'ast_facade.dart';
import 'sink_detector_visitor.dart';
import 'backward_slicer.dart';

/// Transactional branch instrumentation: refuses dirty targets and never overwrites edits on restore.
class DeepTraceInstrumenter {
  final Map<String, String> _originals = {};
  final Map<String, String> _instrumented = {};
  final Map<String, String> _backups = {};
  void instrument(String root, {Set<String>? decisionIds}) {
    final allowedDecisions =
        decisionIds ??
        AstPipeline()
            .scan(root)
            .nodes
            .where((n) => n.kind == 'DECISION')
            .map((n) => n.id)
            .toSet();
    final directory = Directory(p.join(root, 'lib'));
    final plans = <String, String>{};
    for (final file
        in directory
            .listSync(recursive: true, followLinks: false)
            .whereType<File>()
            .where((f) => f.path.endsWith('.dart'))) {
      final original = file.readAsStringSync();
      final unit = AstFacade().parse(original, file.path);
      final visitor = SinkDetectorVisitor();
      unit.accept(visitor);
      final inserts = <int, List<String>>{};
      final seen = <String>{};
      for (final sink in visitor.sinks) {
        for (final step in BackwardControlFlowSlicer().sliceBackwardFromSink(
          sink.node,
        )) {
          if (step.node is! IfStatement) continue;
          final node = step.node as IfStatement;
          final id =
              'decision:${p.relative(file.path, from: root).replaceAll('\\', '/')}:${unit.lineInfo.getLocation(node.offset).lineNumber}:${node.offset}';
          if (!allowedDecisions.contains(id)) continue;
          final branch = step.branch == 'true_branch'
              ? node.thenStatement
              : node.elseStatement;
          if (branch == null || branch is! Block)
            throw StateError(
              'Deep trace requires braced if/else branches: ${file.path}',
            );
          final hit = "$id:${step.branch}";
          if (!seen.add(hit)) continue;
          inserts
              .putIfAbsent(branch.leftBracket.end, () => [])
              .add(
                'FlowProbe.hit(${jsonEncode(hit).replaceAll(r"$", r"\$")});',
              );
        }
      }
      if (inserts.isEmpty) continue;
      if (unit.directives.any((d) => d is PartOfDirective)) {
        throw StateError(
          'Deep trace cannot add an import to a part file: ${file.path}. Use explicit FlowProbe calls from its parent library.',
        );
      }
      final status = Process.runSync('git', [
        '-C',
        root,
        'status',
        '--porcelain',
        '--',
        p.relative(file.path, from: root),
      ]);
      if (status.exitCode != 0 || status.stdout.toString().trim().isNotEmpty)
        throw StateError(
          'Refusing to instrument uncommitted file ${file.path}',
        );
      var text = original;
      for (final offset
          in inserts.keys.toList()..sort((a, b) => b.compareTo(a))) {
        text = text.replaceRange(
          offset,
          offset,
          '\n${inserts[offset]!.join('\n')}\n',
        );
      }
      final libraryEnd =
          unit.directives.whereType<LibraryDirective>().firstOrNull?.end ?? 0;
      text = text.replaceRange(
        libraryEnd,
        libraryEnd,
        "\nimport 'package:flutter_flow_studio/flutter_flow_studio.dart' show FlowProbe;\n",
      );
      plans[file.path] = text;
      _originals[file.path] = original;
    }
    final backupDir = Directory(
      p.join(root, '.dart_tool', 'flow_studio_backups'),
    )..createSync(recursive: true);
    for (final entry in plans.entries) {
      final backup = File(
        p.join(
          backupDir.path,
          '${base64UrlEncode(utf8.encode(entry.key))}.dart',
        ),
      );
      if (backup.existsSync())
        throw StateError(
          'Recover existing trace backup before instrumenting: ${backup.path}',
        );
      _backups[entry.key] = backup.path;
    }
    try {
      for (final entry in plans.entries) {
        final backup = File(_backups[entry.key]!);
        backup.writeAsStringSync(_originals[entry.key]!, flush: true);
        _backups[entry.key] = backup.path;
        File(entry.key).writeAsStringSync(entry.value, flush: true);
        _instrumented[entry.key] = entry.value;
      }
    } catch (_) {
      restore();
      rethrow;
    }
  }

  void restore() {
    final conflicts = <String>[];
    for (final entry in _instrumented.entries.toList()) {
      if (!File(entry.key).existsSync() ||
          File(entry.key).readAsStringSync() != entry.value) {
        conflicts.add(_backups[entry.key]!);
        continue;
      }
      File(entry.key).writeAsStringSync(_originals[entry.key]!, flush: true);
      File(_backups[entry.key]!).deleteSync();
      _instrumented.remove(entry.key);
    }
    if (conflicts.isNotEmpty)
      throw StateError(
        'Files edited during tracing. Originals retained at: ${conflicts.join(', ')}',
      );
  }
}
