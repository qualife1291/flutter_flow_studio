import 'package:flutter/material.dart';
import 'flow_studio_client.dart';

class FlowStudioNavigatorObserver extends NavigatorObserver {
  final void Function(String kind, String? routeName)? onEvent;
  FlowStudioNavigatorObserver({this.onEvent});
  void _send(Route<dynamic> route, String kind) {
    if (route is PopupRoute && kind == 'ROUTE_PUSH') {
      kind = route is ModalBottomSheetRoute
          ? 'BOTTOM_SHEET_OPEN'
          : 'DIALOG_OPEN';
    }
    final name = route.settings.name ?? route.runtimeType.toString();
    if (onEvent != null) {
      onEvent!(kind, name);
    } else {
      FlutterFlowStudio.step(kind, routeName: name);
    }
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      _send(route, 'ROUTE_PUSH');
  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      _send(route, 'ROUTE_POP');
  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    if (newRoute != null) _send(newRoute, 'ROUTE_REPLACE');
  }

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      _send(route, 'ROUTE_POP');
}
