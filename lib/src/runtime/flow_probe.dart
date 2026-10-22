import 'flow_studio_client.dart';

class FlowProbe {
  static void hit(String branch) {
    final split = branch.lastIndexOf(':');
    if (split < 0) return;
    FlutterFlowStudio.step(
      'BRANCH_HIT',
      matchedNodeId: branch.substring(0, split),
      matchedBranchId: branch.substring(split + 1),
    );
  }
}
