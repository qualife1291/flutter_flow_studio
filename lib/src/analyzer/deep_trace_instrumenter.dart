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
  void instrument(String root) {
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
          final branch = step.branch == 'true_branch'
              ? node.thenStatement
              : node.elseStatement;
          if (branch == null || branch is! Block)
            throw StateError(
              'Deep trace requires braced if/else branches: ${file.path}',
            );
          final id =
              'decision:${p.relative(file.path, from: root).replaceAll('\\', '/')}:${unit.lineInfo.getLocation(node.offset).lineNumber}:${node.offset}';
          final hit = "$id:${step.branch}";
          if (!seen.add(hit)) continue;
          inserts
              .putIfAbsent(branch.leftBracket.end, () => [])
              .add('FlowProbe.hit(${jsonEncode(hit)});');
        }
      }
      if (inserts.isEmpty) continue;
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
      text =
          "import 'package:flutter_flow_studio/flutter_flow_studio.dart' show FlowProbe;\n$text";
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
      backup.writeAsStringSync(_originals[entry.key]!, flush: true);
      _backups[entry.key] = backup.path;
      File(entry.key).writeAsStringSync(entry.value, flush: true);
      _instrumented[entry.key] = entry.value;
    }
  }

  void restore() {
    for (final entry in _instrumented.entries) {
      if (File(entry.key).readAsStringSync() != entry.value)
        throw StateError(
          'File edited during tracing; recover original from ${_backups[entry.key]}',
        );
      File(entry.key).writeAsStringSync(_originals[entry.key]!, flush: true);
      File(_backups[entry.key]!).deleteSync();
    }
    _instrumented.clear();
  }
}
