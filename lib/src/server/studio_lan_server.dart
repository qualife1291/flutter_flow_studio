import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_static/shelf_static.dart';
import 'package:shelf_web_socket/shelf_web_socket.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../schema/graph_models.dart';
import '../schema/ws_protocol.dart';

String createStudioToken() => base64UrlEncode(
  List<int>.generate(32, (_) => Random.secure().nextInt(256)),
);

/// Default transport excludes payloads and URL query strings, regardless of client settings.
Json sanitizeEvent(Json input) {
  final event = Map<String, dynamic>.from(input);
  event.remove('customPayload');
  final api = event['apiDetails'];
  if (api is Map) {
    final url = Uri.tryParse(api['url']?.toString() ?? '');
    event['apiDetails'] = {
      for (final k in ['method', 'statusCode', 'durationMs'])
        if (api[k] != null) k: api[k],
      if (url != null)
        'url': url.replace(query: '', fragment: '', userInfo: '').toString(),
    };
  }
  return event;
}

class StudioLanServer {
  final FlowGraphPayload graph;
  final String token;
  final String? assetsPath;
  final List<WebSocketChannel> _clients = [];
  final List<Json> _history = [];
  final Map<String, int> _sequences = {};
  HttpServer? _server;
  StudioLanServer(this.graph, {String? token, this.assetsPath})
    : token = token ?? createStudioToken();
  int get port => _server!.port;
  Future<void> start({String host = '127.0.0.1', int port = 8642}) async {
    final websocket = webSocketHandler((
      WebSocketChannel channel,
      String? protocol,
    ) {
      if (_clients.length >= 32) {
        channel.sink.close(1013, 'Too many clients');
        return;
      }
      _clients.add(channel);
      channel.sink.add(
        jsonEncode({
          'type': 'INITIAL_GRAPH',
          'graph': graph.toJson(),
          'history': _history,
        }),
      );
      channel.stream.listen(
        (message) {
          try {
            if (message is! String || message.length > 65536)
              throw const FormatException('Event too large');
            final parsed = jsonDecode(message);
            if (parsed is! Map<String, dynamic>)
              throw const FormatException('Expected object');
            final event = RuntimeStepEvent.fromJson(parsed).toJson();
            final session = event['sessionId'] as String;
            final order = event['sequenceOrder'] as int;
            if (event['type'] == 'SESSION_RESET') _sequences.remove(session);
            if (order <= (_sequences[session] ?? -1)) return;
            if (!_sequences.containsKey(session) && _sequences.length >= 64)
              _sequences.remove(_sequences.keys.first);
            _sequences[session] = order;
            final safe = sanitizeEvent(event);
            _history.add(safe);
            if (_history.length > 2000) _history.removeAt(0);
            final encoded = jsonEncode(safe);
            for (final client in List<WebSocketChannel>.from(_clients)) {
              client.sink.add(encoded);
            }
          } catch (_) {
            channel.sink.add(
              jsonEncode({
                'type': 'ERROR',
                'message':
                    'Invalid runtime event; send a valid event under 64 KiB.',
              }),
            );
          }
        },
        onDone: () => _clients.remove(channel),
        onError: (Object _) => _clients.remove(channel),
      );
    });
    final static = assetsPath == null
        ? null
        : createStaticHandler(assetsPath!, defaultDocument: 'index.html');
    FutureOr<Response> handler(Request request) {
      final path = request.url.path;
      if (path == 'api/graph' || path == 'ws') {
        final bearer = request.headers['authorization'];
        final supplied = bearer?.startsWith('Bearer ') == true
            ? bearer!.substring(7)
            : request.url.queryParameters['token'];
        if (supplied != token)
          return Response(
            401,
            body:
                'Studio token required. Copy the token from your CLI terminal.',
          );
        if (request.method != 'GET') return Response(405);
        if (path == 'ws') return websocket(request);
        return Response.ok(
          jsonEncode(graph.toJson()),
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          },
        );
      }
      if (path == 'health') return Response.ok('ok');
      if (static != null) return static(request);
      return Response.notFound(
        'Build the Web Studio with npm ci && npm run build in web_studio/.',
      );
    }

    _server = await shelf_io.serve(
      (r) async {
        final response = await handler(r);
        return response.change(
          headers: {
            'x-content-type-options': 'nosniff',
            'referrer-policy': 'no-referrer',
            'x-frame-options': 'DENY',
          },
        );
      },
      host,
      port,
    );
  }

  Future<void> close() async {
    for (final c in List<WebSocketChannel>.from(_clients)) {
      await c.sink.close();
    }
    await _server?.close(force: true);
  }
}
