import 'package:analyzer/dart/ast/ast.dart';

/// Find a subsequent relevant stage in the same lexical block; never cross returns.
String? nextFlowStage(
  AstNode call,
  Map<AstNode, String> stages,
  Set<String> relevant,
) {
  final statement = call.thisOrAncestorOfType<Statement>();
  if (statement == null ||
      statement is ReturnStatement ||
      statement.parent is! Block)
    return null;
  final block = statement.parent as Block;
  final index = block.statements.indexOf(statement);
  if (index < 0) return null;
  for (final next in block.statements.skip(index + 1)) {
    final candidates =
        stages.entries
            .where(
              (e) =>
                  relevant.contains(e.value) &&
                  e.key.offset >= next.offset &&
                  e.key.end <= next.end,
            )
            .toList()
          ..sort((a, b) => a.key.offset.compareTo(b.key.offset));
    if (candidates.isNotEmpty) return candidates.first.value;
    if (next is ReturnStatement ||
        next is BreakStatement ||
        next is ContinueStatement ||
        next is ExpressionStatement && next.expression is ThrowExpression)
      return null;
  }
  return null;
}
