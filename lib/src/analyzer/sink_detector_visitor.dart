import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'adapters/router_adapters.dart';
import 'adapters/network_adapters.dart';

class Sink {
  final AstNode node;
  final String kind;
  Sink(this.node, this.kind);
}

class SinkDetectorVisitor extends RecursiveAstVisitor<void> {
  final Set<String> routedWidgets;
  SinkDetectorVisitor({this.routedWidgets = const {}});
  final sinks = <Sink>[];
  final Set<String> networkTargets = {};
  @override
  void visitCompilationUnit(CompilationUnit node) {
    final types = _NetworkTypes();
    node.accept(types);
    networkTargets.addAll(types.names);
    super.visitCompilationUnit(node);
  }

  final screens = <ClassDeclaration>[];
  final methods = <AstNode>[];
  final calls = <MethodInvocation>[];
  final assignments = <AssignmentExpression>[];
  @override
  void visitAssignmentExpression(AssignmentExpression node) {
    if (node.leftHandSide.toSource() == 'state' ||
        node.leftHandSide.toSource().endsWith('.state')) {
      assignments.add(node);
      sinks.add(Sink(node, 'ACTION'));
    }
    super.visitAssignmentExpression(node);
  }

  @override
  void visitClassDeclaration(ClassDeclaration node) {
    // ignore: deprecated_member_use
    final base = node.extendsClause?.superclass.name2.lexeme;
    if (screenBases.contains(base) &&
        (RegExp(r'(Screen|Page|View)$').hasMatch(node.name.lexeme) ||
            node.metadata.any((a) => a.name.name == 'RoutePage') ||
            routedWidgets.contains(node.name.lexeme) ||
            RegExp(
              '(?:home:|builder:)[^;{}]*\\b${node.name.lexeme}\\s*\\(',
            ).hasMatch(node.root.toSource()))) {
      screens.add(node);
    }
    super.visitClassDeclaration(node);
  }

  @override
  void visitMethodDeclaration(MethodDeclaration node) {
    methods.add(node);
    if (node.metadata.any(
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
    ))
      sinks.add(Sink(node, 'API'));
    super.visitMethodDeclaration(node);
  }

  @override
  void visitFunctionDeclaration(FunctionDeclaration node) {
    methods.add(node);
    super.visitFunctionDeclaration(node);
  }

  @override
  void visitMethodInvocation(MethodInvocation node) {
    calls.add(node);
    if (node.methodName.name == 'on' && node.typeArguments != null)
      methods.add(node);
    final name = node.methodName.name;
    final target = node.target?.toSource() ?? '';
    String? kind;
    if (name == 'emit' && node.argumentList.arguments.isNotEmpty) {
      kind = 'ACTION';
    } else if (logoutMethod.hasMatch(name)) {
      kind = 'LOGOUT';
    } else if (dialogMethods.contains(name)) {
      kind = 'DIALOG';
    } else if (navigationMethods.contains(name) &&
        RegExp(r'(Navigator|context|router|Router|Get)').hasMatch(target)) {
      kind = 'SCREEN';
    } else if (networkMethods.contains(name) &&
        (networkReceiver.hasMatch(target) ||
            networkTargets.contains(target.replaceFirst('this.', '')))) {
      kind = 'API';
    }
    if (kind != null) sinks.add(Sink(node, kind));
    super.visitMethodInvocation(node);
  }
}

class _NetworkTypes extends RecursiveAstVisitor<void> {
  final names = <String>{};
  @override
  void visitVariableDeclaration(VariableDeclaration node) {
    final declaration = node.parent;
    final type = declaration is VariableDeclarationList
        ? declaration.type?.toSource() ?? ''
        : '';
    if (RegExp(r'(Dio|Client|GraphQLClient|SupabaseClient)').hasMatch(type) ||
        RegExp(
          r'^(?:new )?(Dio|Client|GraphQLClient|SupabaseClient)\(',
        ).hasMatch(node.initializer?.toSource() ?? ''))
      names.add(node.name.lexeme);
    super.visitVariableDeclaration(node);
  }
}
