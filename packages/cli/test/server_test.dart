import 'dart:convert';
import 'dart:io';
import 'package:test/test.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/io.dart';
import '../../../lib/src/schema/graph_models.dart';
import '../../../lib/src/server/studio_lan_server.dart';

void main() {
  late StudioLanServer server;
  late HttpClient client;
  setUp(() async {
    server = StudioLanServer(
      FlowGraphPayload(
        project: {'projectName': 'test'},
        nodes: [],
        edges: [],
        healthIssues: [],
      ),
      token: 'test-token',
    );
    await server.start(port: 0);
    client = HttpClient();
  });
  tearDown(() async {
    client.close(force: true);
    await server.close();
  });
  test('graph needs authentication and health does not', () async {
    var request = await client.getUrl(
      Uri.parse('http://127.0.0.1:${server.port}/api/graph'),
    );
    expect((await request.close()).statusCode, 401);
    request = await client.getUrl(
      Uri.parse('http://127.0.0.1:${server.port}/api/graph'),
    );
    request.headers.set('Authorization', 'Bearer test-token');
    final response = await request.close();
    expect(response.statusCode, 200);
    final json = jsonDecode(await utf8.decoder.bind(response).join());
    expect(json['project']['projectName'], 'test');
  });
  test('websocket rejects missing token', () async {
    final channel = IOWebSocketChannel.connect(
      'ws://127.0.0.1:${server.port}/ws',
    );
    channel.stream.listen((_) {}, onError: (Object _) {});
    await expectLater(channel.ready, throwsA(isA<WebSocketChannelException>()));
  });
  test(
    'broadcast strips payloads, URL credentials, and query secrets',
    () async {
      final channel = IOWebSocketChannel.connect(
        'ws://127.0.0.1:${server.port}/ws?token=test-token',
      );
      await channel.ready;
      final stream = channel.stream.asBroadcastStream();
      final initial = jsonDecode(await stream.first);
      expect(initial['type'], 'INITIAL_GRAPH');
      final result = stream.first;
      channel.sink.add(
        jsonEncode({
          'type': 'RUNTIME_STEP',
          'sessionId': 'one',
          'deviceName': 'android',
          'timestamp': 1,
          'sequenceOrder': 1,
          'eventKind': 'API_RESPONSE',
          'customPayload': {'password': 'SECRET'},
          'apiDetails': {
            'method': 'POST',
            'url': 'https://user:SECRET@example.com/login?token=SECRET',
            'requestBody': {'password': 'SECRET'},
            'statusCode': 401,
          },
        }),
      );
      final raw = await result as String;
      expect(raw, isNot(contains('SECRET')));
      expect(jsonDecode(raw)['apiDetails']['statusCode'], 401);
      await channel.sink.close();
    },
  );
  test('malformed event reports error without crashing server', () async {
    final channel = IOWebSocketChannel.connect(
      'ws://127.0.0.1:${server.port}/ws?token=test-token',
    );
    await channel.ready;
    final stream = channel.stream.asBroadcastStream();
    await stream.first;
    final result = stream.first;
    channel.sink.add('{invalid');
    expect(jsonDecode(await result)['type'], 'ERROR');
    await channel.sink.close();
  });
}
