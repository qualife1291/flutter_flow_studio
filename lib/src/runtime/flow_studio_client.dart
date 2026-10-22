import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'platform_info.dart';
import 'http_overrides_stub.dart'
    if (dart.library.io) 'http_overrides.dart'
    as capture;

/// Debug-only runtime. No connection, timer, or HTTP override is created in release.
class FlutterFlowStudio {
  static WebSocketChannel? _channel;
  static Timer? _retry;
  static final Queue<String> _queue = Queue();
  static int _sequence = 0;
  static bool _enabled = false;
  static bool _ready = false;
  static String _session = '';
  static Uri? _uri;
  static int _generation = 0;
  static bool get isEnabled => _enabled;
  static Future<void> init({
    String? host,
    int port = 8642,
    required String token,
    bool captureHttp = true,
    bool secure = false,
  }) async {
    if (kReleaseMode) return;
    await dispose();
    _enabled = true;
    _session = '${devicePlatform}_${DateTime.now().microsecondsSinceEpoch}';
    _sequence = 0;
    _uri = Uri(
      scheme: secure ? 'wss' : 'ws',
      host: host ?? defaultStudioHost,
      port: port,
      path: '/ws',
      queryParameters: {'token': token},
    );
    if (captureHttp)
      capture.installHttpCapture((kind, data) => step(kind, apiDetails: data));
    step('ROUTE_PUSH', type: 'SESSION_CONNECTED');
    unawaited(_connect(_generation));
  }

  static Future<void> _connect(int generation) async {
    if (!_enabled || generation != _generation) return;
    try {
      final channel = WebSocketChannel.connect(_uri!);
      _channel = channel;
      _ready = false;
      await channel.ready.timeout(const Duration(seconds: 5));
      if (!_enabled || generation != _generation) {
        await channel.sink.close();
        return;
      }
      _ready = true;
      while (_queue.isNotEmpty) {
        channel.sink.add(_queue.removeFirst());
      }
      channel.stream.listen(
        (_) {},
        onError: (Object _) => _reconnect(generation),
        onDone: () => _reconnect(generation),
      );
    } catch (_) {
      _reconnect(generation);
    }
  }

  static void _reconnect(int generation) {
    if (!_enabled || generation != _generation || _retry?.isActive == true)
      return;
    final old = _channel;
    _channel = null;
    _ready = false;
    unawaited(old?.sink.close());
    _retry = Timer(const Duration(seconds: 2), () => _connect(generation));
  }

  static void step(
    String eventKind, {
    String type = 'RUNTIME_STEP',
    String? matchedNodeId,
    String? matchedBranchId,
    String? routeName,
    String? stateTypeName,
    Map<String, dynamic>? apiDetails,
  }) {
    if (kReleaseMode || !_enabled) return;
    final safeApi = apiDetails == null
        ? null
        : <String, dynamic>{
            for (final key in ['method', 'statusCode', 'durationMs'])
              if (apiDetails[key] != null) key: apiDetails[key],
            if (apiDetails['url'] is String)
              'url': _safeUrl(apiDetails['url'] as String),
          };
    final message = jsonEncode({
      'type': type,
      'sessionId': _session,
      'deviceName': devicePlatform,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'sequenceOrder': ++_sequence,
      'eventKind': eventKind,
      if (matchedNodeId != null) 'matchedNodeId': matchedNodeId,
      if (matchedBranchId != null) 'matchedBranchId': matchedBranchId,
      if (routeName != null) 'routeName': routeName,
      if (stateTypeName != null) 'stateTypeName': stateTypeName,
      if (safeApi != null) 'apiDetails': safeApi,
    });
    if (_channel != null) {
      // Messages are queued until channel.ready, not sent into an unready sink.
      _queue.add(message);
      scheduleMicrotask(() {
        if (_enabled && _ready && _channel != null) {
          try {
            while (_queue.isNotEmpty) {
              _channel!.sink.add(_queue.removeFirst());
            }
          } catch (_) {
            _reconnect(_generation);
          }
        }
      });
    } else {
      _queue.add(message);
    }
    while (_queue.length > 256) {
      _queue.removeFirst();
    }
  }

  static String _safeUrl(String raw) {
    final uri = Uri.tryParse(raw);
    return uri == null
        ? '[invalid URL]'
        : uri.replace(query: '', fragment: '', userInfo: '').toString();
  }

  static Future<void> dispose() async {
    _enabled = false;
    _ready = false;
    _generation++;
    _retry?.cancel();
    _retry = null;
    capture.uninstallHttpCapture();
    final channel = _channel;
    _channel = null;
    await channel?.sink.close();
    _queue.clear();
  }
}

class FlowStudio {
  static void step(
    String eventKind, {
    String? matchedNodeId,
    String? matchedBranchId,
  }) => FlutterFlowStudio.step(
    eventKind,
    matchedNodeId: matchedNodeId,
    matchedBranchId: matchedBranchId,
  );
}
