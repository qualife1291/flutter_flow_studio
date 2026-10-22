import 'dart:io';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:path/path.dart' as p;
import '../schema/graph_models.dart';
import 'ast_facade.dart';
import 'sink_detector_visitor.dart';
import 'backward_slicer.dart';
import 'cross_layer_linker.dart';
import 'human_readable_translator.dart';
import 'flow_health_auditor.dart';
import 'project_inspector.dart';

class AstPipeline {
  FlowGraphPayload scan(String root) {
    final project = ProjectInspector().inspect(root);
    final nodes = <String, FlowNodeData>{};
    final edges = <String, FlowEdgeData>{};
    final issues = <String, FlowHealthIssue>{};
    final definitions = <String, List<String>>{};
    final calls = <String, Set<String>>{};
    final screens = <String, List<String>>{};
    final pendingNav = <String, String>{};
    final emitted = <String, Set<String>>{};
    final listeners = <String, Set<String>>{};
    final translator = HumanReadableTranslator();
    void edge(
      String source,
      String target, {
      String? handle,
      bool bridge = false,
    }) {
      if (source == target) return;
      final e = FlowEdgeData(
        source: source,
        target: target,
        sourceHandle: handle,
        stateBridge: bridge,
      );
      edges[e.id] = e;
    }

    final directory = Directory(p.join(root, 'lib'));
    if (!directory.existsSync())
      throw ArgumentError('No lib directory in $root');
    final files =
        directory
            .listSync(recursive: true, followLinks: false)
            .whereType<File>()
            .where(
              (f) => f.path.endsWith('.dart') && !f.path.endsWith('.g.dart'),
            )
            .toList()
          ..sort((a, b) => a.path.compareTo(b.path));
    for (final file in files) {
      final source = file.readAsStringSync();
      final relative = p.relative(file.path, from: root).replaceAll('\\', '/');
      final unit = AstFacade().parse(source, relative);
      final visitor = SinkDetectorVisitor();
      unit.accept(visitor);
      String id(AstNode n, String kind) =>
          '${kind.toLowerCase()}:$relative:${unit.lineInfo.getLocation(n.offset).lineNumber}:${n.offset}';
      Json location(AstNode n) {
        final loc = unit.lineInfo.getLocation(n.offset);
        final lines = source.split('\n');
        return {
          'filePath': relative,
          'line': loc.lineNumber,
          'column': loc.columnNumber,
          'codeSnippet': lines
              .skip((loc.lineNumber - 3).clamp(0, lines.length))
              .take(10)
              .join('\n'),
        };
      }

      FlowNodeData make(
        AstNode n,
        String kind,
        String title, {
        Json? decision,
        Json? api,
        Json? dialog,
        Json? route,
      }) {
        final before = source
            .substring(0, n.offset)
            .split('\n')
            .reversed
            .take(3)
            .toList()
            .reversed
            .join('\n');
        final node = FlowNodeData(
          id: id(n, kind),
          kind: kind,
          technicalTitle: title,
          businessTitle: translator.translate(title, comment: before),
          featureGroup: p.split(relative).length > 2
              ? p.split(relative)[1]
              : 'app',
          sourceLocation: location(n),
          decisionInfo: decision,
          apiInfo: api,
          dialogInfo: dialog,
          routeInfo: route,
        );
        nodes[node.id] = node;
        return node;
      }

      AstNode? owner(AstNode n) {
        AstNode? current = n.parent;
        while (current != null &&
            current is! MethodDeclaration &&
            current is! FunctionDeclaration) {
          if (current is FunctionExpression && current.parent is ArgumentList) {
            final registration = current.parent!.parent;
            if (registration is MethodInvocation &&
                registration.methodName.name == 'on' &&
                registration.typeArguments != null)
              return registration;
          }
          current = current.parent;
        }
        return current;
      }

      final methodIds = <AstNode, String>{};
      for (final method in visitor.methods) {
        final name = method is MethodDeclaration
            ? method.name.lexeme
            : method is MethodInvocation
            ? method.typeArguments!.arguments.first.toSource()
            : (method as FunctionDeclaration).name.lexeme;
        final classNode = method.thisOrAncestorOfType<ClassDeclaration>();
        final node = make(
          method,
          'ACTION',
          '${classNode == null ? '' : '${classNode.name.lexeme}.'}$name()',
        );
        methodIds[method] = node.id;
        (definitions[name] ??= []).add(node.id);
      }
      for (final screen in visitor.screens) {
        final node = make(
          screen,
          'SCREEN',
          screen.name.lexeme,
          route: {
            'routePath': screen.name.lexeme,
            'isInitialRoute': RegExp(
              'home:\\s*(?:const\\s+)?${screen.name.lexeme}\\s*\\(',
            ).hasMatch(source),
            'parameters': <String>[],
          },
        );
        (screens[screen.name.lexeme] ??= []).add(node.id);
        for (final entry in methodIds.entries) {
          if (identical(
                entry.key.thisOrAncestorOfType<ClassDeclaration>(),
                screen,
              ) ||
              entry.key
                      .thisOrAncestorOfType<ClassDeclaration>()
                      ?.extendsClause
                      ?.superclass
                      .toSource() ==
                  'State<${screen.name.lexeme}>' ||
              entry.key
                      .thisOrAncestorOfType<ClassDeclaration>()
                      ?.extendsClause
                      ?.superclass
                      .toSource() ==
                  'ConsumerState<${screen.name.lexeme}>')
            edge(node.id, entry.value);
        }
      }
      List<String> stateKeys(Expression value) {
        if (value is MethodInvocation && value.methodName.name == 'copyWith') {
          return value.argumentList.arguments
              .whereType<NamedExpression>()
              .map((a) => '${a.name.label.name}=${a.expression.toSource()}')
              .toList();
        }
        final constructor = RegExp(
          r'^(?:const\s+)?(\w+)(?:<[^>]+>)?\(',
        ).firstMatch(value.toSource())?.group(1);
        return constructor == null ? [] : [constructor];
      }

      for (final assignment in visitor.assignments) {
        for (final key in stateKeys(assignment.rightHandSide)) {
          (emitted[key] ??= {}).add(id(assignment, 'ACTION'));
        }
      }
      for (final call in visitor.calls) {
        final method = owner(call);
        final methodId = methodIds[method];
        if (methodId == null) continue;
        (calls[methodId] ??= {}).add(call.methodName.name);
        if (call.methodName.name == 'add' &&
            call.argumentList.arguments.isNotEmpty) {
          final event = RegExp(
            r'^(\w+)\(',
          ).firstMatch(call.argumentList.arguments.first.toSource())?.group(1);
          if (event != null) (calls[methodId] ??= {}).add(event);
        }
        if (call.methodName.name == 'emit' &&
            call.argumentList.arguments.isNotEmpty) {
          for (final key in stateKeys(call.argumentList.arguments.first)) {
            (emitted[key] ??= {}).add(id(call, 'ACTION'));
          }
        }
      }
      for (final sink in visitor.sinks) {
        final call = sink.node;
        final invocation = call is MethodInvocation ? call : null;
        final annotation = call is MethodDeclaration
            ? call.metadata.firstWhere(
                (a) => {
                  'GET',
                  'POST',
                  'PUT',
                  'DELETE',
                  'PATCH',
                  'HEAD',
                  'Get',
                  'Post',
                  'Put',
                  'Delete',
                  'Patch',
                }.contains(a.name.name),
              )
            : null;
        final methodId =
            methodIds[call is MethodDeclaration ? call : owner(call)];
        final args =
            invocation?.argumentList.arguments ??
            annotation?.arguments?.arguments ??
            <Expression>[];
        final literal =
            args.whereType<SimpleStringLiteral>().firstOrNull?.value ?? '';
        final name =
            invocation?.methodName.name ??
            annotation?.name.name.toLowerCase() ??
            'state';
        Json? api, dialog;
        if (sink.kind == 'API')
          api = {
            'method': {'query', 'mutate'}.contains(name)
                ? 'GRAPHQL'
                : {'get', 'post', 'put', 'delete', 'patch'}.contains(name)
                ? name.toUpperCase()
                : 'GET',
            'endpoint': literal,
            'clientType': invocation?.target?.toSource() ?? 'Retrofit/Chopper',
          };
        if (sink.kind == 'DIALOG')
          dialog = {
            'overlayType': name.toLowerCase().contains('sheet')
                ? 'BOTTOM_SHEET'
                : name.toLowerCase().contains('snack')
                ? 'SNACKBAR'
                : name.toLowerCase().contains('toast')
                ? 'TOAST'
                : 'DIALOG',
            'widgetName':
                RegExp(
                  r'''RouteSettings\(name:\s*['"]([^'"]+)['"]''',
                ).firstMatch(call.toSource())?.group(1) ??
                name,
            'actions': <String>[],
          };
        // Navigation calls are actions, then connect to an actual screen if identifiable.
        final emission = call is AssignmentExpression
            ? stateKeys(call.rightHandSide)
            : invocation?.methodName.name == 'emit' && args.isNotEmpty
            ? stateKeys(args.first)
            : <String>[];
        final node = make(
          call,
          sink.kind == 'SCREEN' ? 'ACTION' : sink.kind,
          emission.length == 1
              ? emission.single
              : sink.kind == 'API'
              ? '${invocation?.target?.toSource() ?? 'API'}.$name($literal)'
              : sink.kind == 'DIALOG'
              ? '${dialog!['widgetName']}()'
              : invocation == null
              ? call.toSource()
              : '${invocation.target?.toSource() ?? ''}.$name()',

          api: api,
          dialog: dialog,
        );
        if (sink.kind == 'SCREEN') {
          final destination = RegExp(
            r'\b(\w+(?:Screen|Page|View))\s*\(',
          ).firstMatch(call.toSource())?.group(1);
          if (destination != null || literal.isNotEmpty)
            pendingNav[node.id] = destination ?? literal;
        }
        String? previous = methodId;
        String? handle;
        final chain = BackwardControlFlowSlicer().sliceBackwardFromSink(call);
        for (final step in chain) {
          final decision = make(
            step.node,
            'DECISION',
            step.expression,
            decision: {
              'kind': step.kind,
              'rawExpression': step.expression,
              'humanReadableRule': translator.translate(step.expression),
              'branches': [
                for (final b in step.branches)
                  {
                    'branchId': b,
                    'technicalLabel': b,
                    'businessLabel': b == 'true_branch'
                        ? 'Hợp lệ'
                        : b == 'false_branch'
                        ? 'Không hợp lệ'
                        : b,
                  },
              ],
            },
          );
          if (previous != null) edge(previous, decision.id, handle: handle);
          previous = decision.id;
          handle = step.branch;
          if (step.node is IfStatement &&
              (step.node as IfStatement).elseStatement == null) {
            final statement = step.node as IfStatement;
            final block = statement.parent;
            final hasFallback =
                block is Block &&
                block.statements.any(
                  (s) =>
                      s.offset > statement.end &&
                      visitor.sinks.any(
                        (v) => v.node.offset >= s.offset && v.node.end <= s.end,
                      ),
                );
            if (!hasFallback) {
              final issue = FlowHealthIssue(
                'MISSING_ELSE_BRANCH',
                decision.id,
                'Thiếu nhánh xử lý khi điều kiện sai',
                'Bổ sung phản hồi hoặc đường xử lý cho nhánh sai.',
              );
              issues[issue.data['id']] = issue;
            }
          }
          for (final state in RegExp(
            r'\bis\s+(\w+)',
          ).allMatches(step.expression)) {
            (listeners[state[1]!] ??= {}).add(decision.id);
          }
          for (final predicate in RegExp(
            r'\w+\.(\w+)\s*==\s*([A-Z]\w*\.\w+)',
          ).allMatches(step.expression)) {
            (listeners['${predicate[1]}=${predicate[2]}'] ??= {}).add(
              decision.id,
            );
          }
        }
        if (previous != null) edge(previous, node.id, handle: handle);
        if (sink.kind == 'API' && invocation != null) {
          final guarded =
              chain.any(
                (s) =>
                    s.node is TryStatement &&
                    (s.node as TryStatement).catchClauses.isNotEmpty,
              ) ||
              call.toSource().contains('catchError') ||
              call.parent?.toSource().contains('.catchError(') == true ||
              chain.any((s) => s.kind == 'EITHER_FOLD');
          if (!guarded) {
            final issue = FlowHealthIssue(
              'UNHANDLED_API_ERROR',
              node.id,
              'API chưa có xử lý lỗi',
              'Bắt lỗi mạng và phản hồi cho người dùng.',
            );
            issues[issue.data['id']] = issue;
          }
        }
      }
    }
    for (final e in CrossLayerLinker().link(definitions, calls)) {
      edges[e.id] = e;
    }
    for (final entry in pendingNav.entries) {
      if (screens[entry.value]?.length == 1)
        edge(entry.key, screens[entry.value]!.single);
    }
    for (final entry in emitted.entries) {
      for (final emitter in entry.value) {
        for (final listener in listeners[entry.key] ?? <String>{}) {
          edge(emitter, listener, bridge: true);
        }
      }
    }
    // Retain only actions participating in a sink path, removing unrelated UI methods.
    final relevant =
        nodes.values.where((n) => n.kind != 'ACTION').map((n) => n.id).toSet()
          ..addAll(pendingNav.keys);
    bool changed;
    do {
      changed = false;
      for (final e in edges.values) {
        if (relevant.contains(e.target) && relevant.add(e.source))
          changed = true;
      }
    } while (changed);
    nodes.removeWhere((key, value) => !relevant.contains(key));
    edges.removeWhere(
      (key, value) =>
          !nodes.containsKey(value.source) || !nodes.containsKey(value.target),
    );
    for (final issue in FlowHealthAuditor().audit(
      nodes.values.toList(),
      edges.values.toList(),
    )) {
      issues[issue.data['id']] = issue;
    }
    project['stats'] = {
      for (final entry in {
        'totalScreens': 'SCREEN',
        'totalActions': 'ACTION',
        'totalDecisions': 'DECISION',
        'totalApis': 'API',
        'totalDialogs': 'DIALOG',
        'totalLogoutPoints': 'LOGOUT',
      }.entries)
        entry.key: nodes.values.where((n) => n.kind == entry.value).length,
    };
    return FlowGraphPayload(
      project: project,
      nodes: nodes.values.toList(),
      edges: edges.values.toList(),
      healthIssues: issues.values.toList(),
    );
  }
}
