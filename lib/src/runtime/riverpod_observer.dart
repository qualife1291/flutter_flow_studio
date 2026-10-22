import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'flow_studio_client.dart';

class FlowStudioProviderObserver extends ProviderObserver {
  @override
  void didUpdateProvider(
    ProviderBase<Object?> provider,
    Object? previousValue,
    Object? newValue,
    ProviderContainer container,
  ) {
    FlutterFlowStudio.step(
      'STATE_EMITTED',
      stateTypeName: newValue.runtimeType.toString(),
    );
  }
}
