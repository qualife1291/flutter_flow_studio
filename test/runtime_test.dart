import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_flow_studio/flutter_flow_studio.dart';

void main() {
  test('disabled runtime does nothing until explicitly initialized', () {
    expect(FlutterFlowStudio.isEnabled, isFalse);
    FlowProbe.hit('decision:one:true_branch');
  });
  testWidgets(
    'navigator observer sees page, dialog, bottom sheet, pop and replacement',
    (tester) async {
      final events = <String>[];
      final navigator = GlobalKey<NavigatorState>();
      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: navigator,
          navigatorObservers: [
            FlowStudioNavigatorObserver(
              onEvent: (kind, name) => events.add(kind),
            ),
          ],
          home: const Scaffold(body: Text('home')),
        ),
      );
      final context = navigator.currentContext!;
      unawaited(
        showDialog<void>(
          context: context,
          builder: (_) => const AlertDialog(title: Text('dialog')),
        ),
      );
      await tester.pumpAndSettle();
      navigator.currentState!.pop();
      await tester.pumpAndSettle();
      unawaited(
        showModalBottomSheet<void>(
          context: context,
          builder: (_) => const Text('sheet'),
        ),
      );
      await tester.pumpAndSettle();
      navigator.currentState!.pop();
      await tester.pumpAndSettle();
      unawaited(
        navigator.currentState!.pushReplacement(
          MaterialPageRoute<void>(
            settings: const RouteSettings(name: 'other'),
            builder: (_) => const Text('other'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        events,
        containsAll([
          'ROUTE_PUSH',
          'DIALOG_OPEN',
          'BOTTOM_SHEET_OPEN',
          'ROUTE_POP',
          'ROUTE_REPLACE',
        ]),
      );
    },
  );
}
