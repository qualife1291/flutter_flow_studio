import 'dart:async';
import 'dart:io';
import 'dart:convert';
import 'package:test/test.dart';
import '../../../lib/src/runtime/http_overrides.dart';

void main() {
  test('HTTP capture forwards request bytes and response untouched', () async {
    final events = <String>[];
    final server = await HttpServer.bind('127.0.0.1', 0);
    server.listen((request) async {
      final body = await utf8.decoder.bind(request).join();
      request.response.write('echo:$body');
      await request.response.close();
    });
    installHttpCapture((kind, data) => events.add(kind));
    final client = HttpClient();
    try {
      final request = await client.postUrl(
        Uri.parse('http://127.0.0.1:${server.port}/test?password=secret'),
      );
      request.write('hello');
      final response = await request.close();
      expect(await utf8.decoder.bind(response).join(), 'echo:hello');
      expect(events, ['API_REQUEST', 'API_RESPONSE']);
    } finally {
      client.close(force: true);
      uninstallHttpCapture();
      await server.close(force: true);
    }
  });

  test(
    'capture lifecycle preserves global overrides when called inside an HTTP zone',
    () {
      final previous = Zone.root.run(() => HttpOverrides.current);
      final local = _LocalOverrides();
      HttpOverrides.runWithHttpOverrides(() {
        installHttpCapture((kind, data) {});
        expect(HttpOverrides.current, same(local));
        expect(
          Zone.root.run(() => HttpOverrides.current),
          isNot(same(previous)),
        );
        uninstallHttpCapture();
        expect(Zone.root.run(() => HttpOverrides.current), same(previous));
      }, local);
    },
  );
}

class _LocalOverrides extends HttpOverrides {}
