import '../schema/graph_models.dart';

/// Name-only calls are linked only when the destination is unambiguous.
/// Resolved type analysis is intentionally not fabricated for ambiguous calls.
class CrossLayerLinker {
  List<FlowEdgeData> link(
    Map<String, List<String>> definitions,
    Map<String, Set<String>> calls,
  ) {
    final edges = <FlowEdgeData>[];
    for (final entry in calls.entries) {
      for (final name in entry.value) {
        final targets = definitions[name];
        if (targets?.length == 1 && targets!.single != entry.key) {
          edges.add(
            FlowEdgeData(
              source: entry.key,
              target: targets.single,
              label: 'calls $name',
            ),
          );
        }
      }
    }
    return edges;
  }
}
