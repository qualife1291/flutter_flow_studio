import 'dart:async';
import 'dart:convert';
import 'dart:io';

typedef EmitHttp = void Function(String, Map<String, dynamic>);
FlowStudioHttpOverrides? _installed;
void installHttpCapture(EmitHttp emit) {
  if (_installed != null) return;
  _installed = FlowStudioHttpOverrides(
    Zone.root.run(() => HttpOverrides.current),
    emit,
  );
  HttpOverrides.global = _installed;
}

void uninstallHttpCapture() {
  if (_installed == null) return;
  if (identical(Zone.root.run(() => HttpOverrides.current), _installed))
    HttpOverrides.global = _installed!.previous;
  _installed = null;
}

class FlowStudioHttpOverrides extends HttpOverrides {
  final HttpOverrides? previous;
  final EmitHttp emit;
  FlowStudioHttpOverrides(this.previous, this.emit);
  @override
  HttpClient createHttpClient(SecurityContext? context) => _Client(
    previous?.createHttpClient(context) ?? super.createHttpClient(context),
    emit,
  );
}

class _Client implements HttpClient {
  final HttpClient inner;
  final EmitHttp emit;
  _Client(this.inner, this.emit);
  @override
  Future<HttpClientRequest> openUrl(String method, Uri url) async {
    // Studio websocket traffic must never observe itself.
    if (url.path == '/ws') return inner.openUrl(method, url);
    final timer = Stopwatch()..start();
    final data = <String, dynamic>{
      'method': method,
      'url': url.replace(query: '', fragment: '', userInfo: '').toString(),
    };
    emit('API_REQUEST', data);
    try {
      return _Request(
        await inner.openUrl(method, url),
        (int? status) => emit('API_RESPONSE', {
          ...data,
          if (status != null) 'statusCode': status,
          'durationMs': timer.elapsedMilliseconds,
        }),
      );
    } catch (_) {
      emit('API_RESPONSE', {...data, 'durationMs': timer.elapsedMilliseconds});
      rethrow;
    }
  }

  @override
  Future<HttpClientRequest> open(
    String method,
    String host,
    int port,
    String path,
  ) => openUrl(
    method,
    Uri(scheme: 'http', host: host, port: port).resolve(path),
  );
  @override
  Future<HttpClientRequest> getUrl(Uri url) => openUrl('GET', url);
  @override
  Future<HttpClientRequest> postUrl(Uri url) => openUrl('POST', url);
  @override
  Future<HttpClientRequest> putUrl(Uri url) => openUrl('PUT', url);
  @override
  Future<HttpClientRequest> deleteUrl(Uri url) => openUrl('DELETE', url);
  @override
  Future<HttpClientRequest> patchUrl(Uri url) => openUrl('PATCH', url);
  @override
  Future<HttpClientRequest> headUrl(Uri url) => openUrl('HEAD', url);
  @override
  Future<HttpClientRequest> get(String h, int p, String path) =>
      open('GET', h, p, path);
  @override
  Future<HttpClientRequest> post(String h, int p, String path) =>
      open('POST', h, p, path);
  @override
  Future<HttpClientRequest> put(String h, int p, String path) =>
      open('PUT', h, p, path);
  @override
  Future<HttpClientRequest> delete(String h, int p, String path) =>
      open('DELETE', h, p, path);
  @override
  Future<HttpClientRequest> patch(String h, int p, String path) =>
      open('PATCH', h, p, path);
  @override
  Future<HttpClientRequest> head(String h, int p, String path) =>
      open('HEAD', h, p, path);
  @override
  void close({bool force = false}) => inner.close(force: force);
  @override
  bool get autoUncompress => inner.autoUncompress;
  @override
  set autoUncompress(bool v) => inner.autoUncompress = v;
  @override
  Duration? get connectionTimeout => inner.connectionTimeout;
  @override
  set connectionTimeout(Duration? v) => inner.connectionTimeout = v;
  @override
  Duration get idleTimeout => inner.idleTimeout;
  @override
  set idleTimeout(Duration v) => inner.idleTimeout = v;
  @override
  int? get maxConnectionsPerHost => inner.maxConnectionsPerHost;
  @override
  set maxConnectionsPerHost(int? v) => inner.maxConnectionsPerHost = v;
  @override
  String? get userAgent => inner.userAgent;
  @override
  set userAgent(String? v) => inner.userAgent = v;
  @override
  set authenticate(Future<bool> Function(Uri, String, String?)? f) =>
      inner.authenticate = f;
  @override
  set authenticateProxy(
    Future<bool> Function(String, int, String, String?)? f,
  ) => inner.authenticateProxy = f;
  @override
  set badCertificateCallback(bool Function(X509Certificate, String, int)? f) =>
      inner.badCertificateCallback = f;
  @override
  set findProxy(String Function(Uri)? f) => inner.findProxy = f;
  @override
  set connectionFactory(
    Future<ConnectionTask<Socket>> Function(Uri, String?, int?)? f,
  ) => inner.connectionFactory = f;
  @override
  set keyLog(void Function(String)? f) => inner.keyLog = f;
  @override
  void addCredentials(
    Uri url,
    String realm,
    HttpClientCredentials credentials,
  ) => inner.addCredentials(url, realm, credentials);
  @override
  void addProxyCredentials(
    String host,
    int port,
    String realm,
    HttpClientCredentials credentials,
  ) => inner.addProxyCredentials(host, port, realm, credentials);
}

class _Request implements HttpClientRequest {
  final HttpClientRequest inner;
  final void Function(int?) complete;
  _Request(this.inner, this.complete);
  @override
  Future<HttpClientResponse> close() async {
    try {
      final r = await inner.close();
      complete(r.statusCode);
      return r;
    } catch (_) {
      complete(null);
      rethrow;
    }
  }

  @override
  void abort([Object? exception, StackTrace? stackTrace]) =>
      inner.abort(exception, stackTrace);
  @override
  void add(List<int> data) => inner.add(data);
  @override
  void addError(Object error, [StackTrace? stackTrace]) =>
      inner.addError(error, stackTrace);
  @override
  Future<void> addStream(Stream<List<int>> stream) => inner.addStream(stream);
  @override
  Future<void> flush() => inner.flush();
  @override
  void write(Object? object) => inner.write(object);
  @override
  void writeAll(Iterable<dynamic> objects, [String separator = '']) =>
      inner.writeAll(objects, separator);
  @override
  void writeCharCode(int charCode) => inner.writeCharCode(charCode);
  @override
  void writeln([Object? object = '']) => inner.writeln(object);
  @override
  Encoding get encoding => inner.encoding;
  @override
  set encoding(Encoding e) => inner.encoding = e;
  @override
  Future<HttpClientResponse> get done => inner.done;
  @override
  HttpHeaders get headers => inner.headers;
  @override
  List<Cookie> get cookies => inner.cookies;
  @override
  String get method => inner.method;
  @override
  Uri get uri => inner.uri;
  @override
  HttpConnectionInfo? get connectionInfo => inner.connectionInfo;
  @override
  bool get bufferOutput => inner.bufferOutput;
  @override
  set bufferOutput(bool b) => inner.bufferOutput = b;
  @override
  int get contentLength => inner.contentLength;
  @override
  set contentLength(int i) => inner.contentLength = i;
  @override
  bool get followRedirects => inner.followRedirects;
  @override
  set followRedirects(bool b) => inner.followRedirects = b;
  @override
  int get maxRedirects => inner.maxRedirects;
  @override
  set maxRedirects(int i) => inner.maxRedirects = i;
  @override
  bool get persistentConnection => inner.persistentConnection;
  @override
  set persistentConnection(bool b) => inner.persistentConnection = b;
}
