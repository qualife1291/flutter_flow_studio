import 'package:dio/dio.dart';
import 'flow_studio_client.dart';

class FlowStudioDioInterceptor extends Interceptor {
  final Expando<Stopwatch> _timers = Expando();
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    _timers[options] = Stopwatch()..start();
    FlutterFlowStudio.step(
      'API_REQUEST',
      apiDetails: {'method': options.method, 'url': options.uri.toString()},
    );
    handler.next(options);
  }

  void _response(RequestOptions options, int? status) {
    FlutterFlowStudio.step(
      'API_RESPONSE',
      apiDetails: {
        'method': options.method,
        'url': options.uri.toString(),
        if (status != null) 'statusCode': status,
        'durationMs': _timers[options]?.elapsedMilliseconds ?? 0,
      },
    );
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    _response(response.requestOptions, response.statusCode);
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _response(err.requestOptions, err.response?.statusCode);
    handler.next(err);
  }
}
