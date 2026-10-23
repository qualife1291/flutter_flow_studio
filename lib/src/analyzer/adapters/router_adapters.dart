// Stable syntax API names support the complete analyzer/SDK matrix.
// ignore_for_file: deprecated_member_use
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';

const navigationMethods = {
  'push',
  'pushNamed',
  'pushReplacement',
  'pushReplacementNamed',
  'pushAndRemoveUntil',
  'pushNamedAndRemoveUntil',
  'popAndPushNamed',
  'go',
  'goNamed',
  'replace',
  'replaceNamed',
  'to',
  'off',
  'offAll',
  'offNamed',
  'offAllNamed',
};
const dialogMethods = {
  'showDialog',
  'showGeneralDialog',
  'showCupertinoDialog',
  'showModalBottomSheet',
  'showBottomSheet',
  'showSnackBar',
  'dialog',
  'bottomSheet',
  'snackbar',
  'showToast',
};
const screenBases = {
  'StatelessWidget',
  'StatefulWidget',
  'ConsumerWidget',
  'ConsumerStatefulWidget',
  'HookWidget',
  'GetView',
};

class WidgetClassCollector extends RecursiveAstVisitor<void> {
  final names = <String>{};
  @override
  void visitClassDeclaration(ClassDeclaration node) {
    if (screenBases.contains(node.extendsClause?.superclass.name2.lexeme))
      names.add(node.name.lexeme);
    super.visitClassDeclaration(node);
  }
}

class _WidgetReferences extends RecursiveAstVisitor<void> {
  final Set<String> widgetTypes;
  final names = <String>{};
  _WidgetReferences(this.widgetTypes);
  @override
  void visitInstanceCreationExpression(InstanceCreationExpression node) {
    final name = node.constructorName.type.name2.lexeme;
    if (widgetTypes.contains(name)) names.add(name);
    super.visitInstanceCreationExpression(node);
  }

  @override
  void visitMethodInvocation(MethodInvocation node) {
    if (node.target == null && widgetTypes.contains(node.methodName.name))
      names.add(node.methodName.name);
    super.visitMethodInvocation(node);
  }

  @override
  void visitSimpleIdentifier(SimpleIdentifier node) {
    if (widgetTypes.contains(node.name)) names.add(node.name);
    super.visitSimpleIdentifier(node);
  }
}

String? referencedWidget(AstNode value, Set<String> widgetTypes) {
  final visitor = _WidgetReferences(widgetTypes);
  value.accept(visitor);
  return visitor.names.length == 1 ? visitor.names.single : null;
}

class RouteDiscovery extends RecursiveAstVisitor<void> {
  final Set<String> widgetTypes;
  final targets = <String, String>{};
  final initialRoutes = <String>{'/'};
  final routerTypes = <String, String>{};
  RouteDiscovery(this.widgetTypes);
  void _route(String key, String? target, [String router = 'Navigator']) {
    if (target != null) {
      targets[key] = target;
      routerTypes[target] = router;
    }
  }

  @override
  void visitMapLiteralEntry(MapLiteralEntry node) {
    if (node.key is SimpleStringLiteral)
      _route(
        (node.key as SimpleStringLiteral).value,
        referencedWidget(node.value, widgetTypes),
      );
    super.visitMapLiteralEntry(node);
  }

  void _arguments(ArgumentList args, String router) {
    final named = {
      for (final a in args.arguments.whereType<NamedExpression>())
        a.name.label.name: a.expression,
    };
    final target = named['builder'] ?? named['pageBuilder'] ?? named['page'];
    if (target == null) return;
    final widget = referencedWidget(target, widgetTypes);
    for (final key in ['path', 'name']) {
      final value = named[key];
      if (value is SimpleStringLiteral) {
        var path = value.value;
        if (key == 'path' && router == 'GoRouter' && !path.startsWith('/')) {
          AstNode? ancestor = args.parent?.parent;
          while (ancestor != null) {
            final parentArgs =
                ancestor is InstanceCreationExpression &&
                    ancestor.constructorName.type.name2.lexeme == 'GoRoute'
                ? ancestor.argumentList
                : ancestor is MethodInvocation &&
                      ancestor.methodName.name == 'GoRoute'
                ? ancestor.argumentList
                : null;
            if (parentArgs != null) {
              final parentPath = parentArgs.arguments
                  .whereType<NamedExpression>()
                  .where((a) => a.name.label.name == 'path')
                  .firstOrNull
                  ?.expression;
              if (parentPath is! SimpleStringLiteral) break;
              path =
                  '${parentPath.value.replaceFirst(RegExp(r'/+$'), '')}/$path';
              if (path.startsWith('/')) break;
            }
            ancestor = ancestor.parent;
          }
        }
        _route(path, widget, router);
      }
    }
    final settings = named['settings'];
    if (settings != null) {
      final match = RegExp(
        r'''name:\s*['"]([^'"]+)['"]''',
      ).firstMatch(settings.toSource());
      if (match != null) _route(match[1]!, widget, router);
    }
  }

  @override
  void visitInstanceCreationExpression(InstanceCreationExpression node) {
    if ({
      'GoRoute',
      'AutoRoute',
      'BeamPage',
      'MaterialPageRoute',
      'CupertinoPageRoute',
    }.contains(node.constructorName.type.name2.lexeme))
      _arguments(
        node.argumentList,
        node.constructorName.type.name2.lexeme == 'GoRoute'
            ? 'GoRouter'
            : node.constructorName.type.name2.lexeme,
      );
    super.visitInstanceCreationExpression(node);
  }

  @override
  void visitMethodInvocation(MethodInvocation node) {
    if ({
      'GoRoute',
      'AutoRoute',
      'BeamPage',
      'MaterialPageRoute',
      'CupertinoPageRoute',
    }.contains(node.methodName.name))
      _arguments(
        node.argumentList,
        node.methodName.name == 'GoRoute' ? 'GoRouter' : node.methodName.name,
      );
    super.visitMethodInvocation(node);
  }

  @override
  void visitNamedExpression(NamedExpression node) {
    if (node.name.label.name == 'home')
      _route('/', referencedWidget(node.expression, widgetTypes));
    if (node.name.label.name == 'initialRoute' &&
        node.expression is SimpleStringLiteral)
      initialRoutes.add((node.expression as SimpleStringLiteral).value);
    super.visitNamedExpression(node);
  }
}
