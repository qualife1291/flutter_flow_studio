import 'package:analyzer/dart/ast/ast.dart';

class DecisionChainStep {
  final AstNode node;
  final String kind, expression, branch;
  final List<String> branches;
  DecisionChainStep(
    this.node,
    this.kind,
    this.expression,
    this.branch,
    this.branches,
  );
}

class BackwardControlFlowSlicer {
  List<DecisionChainStep> sliceBackwardFromSink(AstNode sink) {
    final chain = <DecisionChainStep>[];
    AstNode? child = sink;
    AstNode? current = sink.parent;
    while (current != null &&
        current is! MethodDeclaration &&
        current is! FunctionDeclaration) {
      if (current is IfStatement) {
        chain.add(
          DecisionChainStep(
            current,
            'IF_ELSE',
            current.expression.toSource(),
            identical(child, current.thenStatement)
                ? 'true_branch'
                : 'false_branch',
            ['true_branch', 'false_branch'],
          ),
        );
      } else if (current is SwitchMember) {
        final statement = current.parent;
        if (statement is SwitchStatement) {
          String key(SwitchMember m) => 'case_${statement.members.indexOf(m)}';
          chain.add(
            DecisionChainStep(
              statement,
              'SWITCH',
              statement.expression.toSource(),
              key(current),
              statement.members.map(key).toList(),
            ),
          );
        }
      } else if (current is TryStatement) {
        var branch = 'try_branch';
        if (child is CatchClause)
          branch = 'catch_${current.catchClauses.indexOf(child)}';
        if (identical(child, current.finallyBlock)) branch = 'finally_branch';
        chain.add(
          DecisionChainStep(current, 'TRY_CATCH', 'try / catch', branch, [
            'try_branch',
            for (var i = 0; i < current.catchClauses.length; i++) 'catch_$i',
            if (current.finallyBlock != null) 'finally_branch',
          ]),
        );
      } else if (current is MethodInvocation &&
          {'fold', 'when', 'maybeWhen'}.contains(current.methodName.name)) {
        final args = current.argumentList.arguments;
        final index = args.indexWhere(
          (a) => a.offset <= sink.offset && a.end >= sink.end,
        );
        if (index >= 0) {
          String key(int i) => args[i] is NamedExpression
              ? (args[i] as NamedExpression).name.label.name
              : 'branch_$i';
          chain.add(
            DecisionChainStep(
              current,
              'EITHER_FOLD',
              current.target?.toSource() ?? 'result',
              key(index),
              [for (var i = 0; i < args.length; i++) key(i)],
            ),
          );
        }
      }
      child = current;
      current = current.parent;
    }
    return chain.reversed.toList();
  }
}
