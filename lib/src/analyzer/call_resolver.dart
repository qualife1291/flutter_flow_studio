import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';

/// Conservative syntax resolution: explicit types win; ambiguous names stay unresolved.
class CallResolver extends RecursiveAstVisitor<void> {
  final _types = <String, Set<String>>{};
  void _remember(String name, String? type, AstNode node) {
    if (type == null || type.isEmpty) return;
    type = type.split('<').first.replaceAll('?', '').split('.').last;
    if (!RegExp(r'^[A-Z]').hasMatch(type)) return;
    final owner = node.thisOrAncestorOfType<ClassDeclaration>()?.name.lexeme;
    (_types['${owner ?? ''}:$name'] ??= {}).add(type);
  }

  @override
  void visitVariableDeclaration(VariableDeclaration node) {
    final declaration = node.parent;
    String? type = declaration is VariableDeclarationList
        ? declaration.type?.toSource()
        : null;
    final initializer = node.initializer;
    if (type == null && initializer is InstanceCreationExpression)
      type = initializer.constructorName.type.toSource();
    if (type == null &&
        initializer is MethodInvocation &&
        initializer.target == null)
      type = initializer.methodName.name;
    _remember(node.name.lexeme, type, node);
    super.visitVariableDeclaration(node);
  }

  @override
  void visitSimpleFormalParameter(SimpleFormalParameter node) {
    if (node.name != null)
      _remember(node.name!.lexeme, node.type?.toSource(), node);
    super.visitSimpleFormalParameter(node);
  }

  String? receiverClass(MethodInvocation call) {
    final target = call.target?.toSource();
    final owner = call.thisOrAncestorOfType<ClassDeclaration>();
    if (target == null || target == 'this') {
      if (owner?.members.whereType<MethodDeclaration>().any(
            (m) => m.name.lexeme == call.methodName.name,
          ) ==
          true)
        return owner!.name.lexeme;
      return null;
    }
    final generic = RegExp(
      r'(?:read|watch|of|find)<([A-Z]\w*)>',
    ).firstMatch(target)?.group(1);
    if (generic != null) return generic;
    final variable = target.replaceFirst('this.', '');
    final types =
        _types['${owner?.name.lexeme ?? ''}:$variable'] ?? _types[':$variable'];
    if (types?.length == 1) return types!.single;
    if (RegExp(r'^[A-Z]\w*$').hasMatch(target)) return target;
    return null;
  }

  String key(MethodInvocation call) {
    final type = receiverClass(call);
    return type == null
        ? call.methodName.name
        : '$type.${call.methodName.name}';
  }
}
