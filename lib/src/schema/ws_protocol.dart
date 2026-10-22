import 'graph_models.dart';

const runtimeKinds = {
  'ROUTE_PUSH',
  'ROUTE_POP',
  'ROUTE_REPLACE',
  'DIALOG_OPEN',
  'BOTTOM_SHEET_OPEN',
  'SNACKBAR_SHOW',
  'API_REQUEST',
  'API_RESPONSE',
  'STATE_EMITTED',
  'BRANCH_HIT',
  'LOGOUT_TRIGGERED',
};

class RuntimeStepEvent extends WireModel {
  RuntimeStepEvent.fromJson(Json json) : super(json) {
    if (!{
          'RUNTIME_STEP',
          'SESSION_CONNECTED',
          'SESSION_RESET',
        }.contains(json['type']) ||
        json['sessionId'] is! String ||
        (json['sessionId'] as String).length > 200 ||
        json['deviceName'] is! String ||
        json['timestamp'] is! num ||
        json['sequenceOrder'] is! int ||
        !runtimeKinds.contains(json['eventKind']) ||
        (json['sequenceOrder'] as int) < 0 ||
        !(json['timestamp'] as num).isFinite ||
        ['matchedNodeId', 'matchedBranchId', 'routeName', 'stateTypeName'].any(
          (key) =>
              json[key] != null &&
              (json[key] is! String || (json[key] as String).length > 4096),
        ) ||
        (json['apiDetails'] != null &&
            (json['apiDetails'] is! Map ||
                json['apiDetails']['method'] is! String ||
                json['apiDetails']['url'] is! String))) {
      throw const FormatException('Invalid runtime event');
    }
  }
}
