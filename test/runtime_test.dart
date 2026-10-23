import 'dart:io';
import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_flow_studio/flutter_flow_studio.dart';

void main() {
  test('disabled runtime does nothing until explicitly initialized', () {
    expect(FlutterFlowStudio.isEnabled, isFalse);
    FlowProbe.hit('decision:one:true_branch');
  });

  test(
    'debug SDK queues and delivers probes through a real WebSocket without payload secrets',
    () async {
      await HttpOverrides.runWithHttpOverrides(() async {
        final server = await HttpServer.bind('127.0.0.1', 0);
        final branch = Completer<Map<String, dynamic>>(),
            api = Completer<Map<String, dynamic>>();
        server.listen((request) async {
          expect(request.uri.queryParameters['token'], 'test-token');
          final socket = await WebSocketTransformer.upgrade(request);
          socket.listen((data) {
            final event = jsonDecode(data as String) as Map<String, dynamic>;
            if (event['eventKind'] == 'BRANCH_HIT' && !branch.isCompleted)
              branch.complete(event);
            if (event['eventKind'] == 'API_REQUEST' && !api.isCompleted)
              api.complete(event);
          });
        });
        try {
          await FlutterFlowStudio.init(
            host: '127.0.0.1',
            port: server.port,
            token: 'test-token',
            captureHttp: false,
          );
          FlowProbe.hit('decision:login:true_branch');
          FlutterFlowStudio.step(
            'API_REQUEST',
            apiDetails: {
              'method': 'GET',
              'url': 'https://user:password@example.com/items?token=secret',
              'requestBody': {'secret': 'secret'},
            },
          );
          final probe = await branch.future.timeout(
            const Duration(seconds: 10),
          );
          final request = await api.future.timeout(const Duration(seconds: 10));
          expect(probe['matchedNodeId'], 'decision:login');
          expect(probe['matchedBranchId'], 'true_branch');
          expect(jsonEncode(request), isNot(contains('secret')));
          expect(jsonEncode(request), isNot(contains('password')));
          expect(
            probe['sequenceOrder'],
            lessThan(request['sequenceOrder'] as int),
          );
        } finally {
          await FlutterFlowStudio.dispose();
          await server.close(force: true);
        }
      }, _RealHttpOverrides());
    },
  );
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

class _RealHttpOverrides extends HttpOverrides {}
