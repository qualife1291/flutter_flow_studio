import '../schema/graph_models.dart';

class FlowHealthAuditor {
  List<FlowHealthIssue> audit(
    List<FlowNodeData> nodes,
    List<FlowEdgeData> edges,
  ) => [
    for (final node in nodes)
      if (node.kind == 'SCREEN' &&
          node.data['routeInfo']?['isInitialRoute'] != true &&
          !edges.any((e) => e.target == node.id))
        FlowHealthIssue(
          'ORPHAN_SCREEN',
          node.id,
          'Màn hình chưa có đường dẫn vào',
          'Kiểm tra route và các điểm điều hướng.',
          severity: 'INFO',
        ),
  ];
}
