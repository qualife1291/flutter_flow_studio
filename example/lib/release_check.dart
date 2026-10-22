import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_flow_studio/flutter_flow_studio.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!kReleaseMode) {
    throw StateError('This check must run as a release build.');
  }
  await FlutterFlowStudio.init(
    host: '127.0.0.1',
    token: 'non-secret-release-test',
    port: 8642,
  );
  FlowProbe.hit('test:true_branch');
  if (FlutterFlowStudio.isEnabled) {
    throw StateError('Release runtime opened a transport.');
  }
  // The browser check waits for this sentinel and asserts no WebSocket was created.
  // ignore: avoid_print
  print('FLOW_STUDIO_RELEASE_NO_SOCKET_PASS');
  runApp(
    const MaterialApp(home: Scaffold(body: Text('Release runtime disabled'))),
  );
}
