import 'package:bloc/bloc.dart';
import 'flow_studio_client.dart';

class FlowStudioBlocObserver extends BlocObserver {
  final BlocObserver? delegate;
  FlowStudioBlocObserver({this.delegate});
  @override
  void onChange(BlocBase<dynamic> bloc, Change<dynamic> change) {
    FlutterFlowStudio.step(
      'STATE_EMITTED',
      stateTypeName: change.nextState.runtimeType.toString(),
    );
    delegate?.onChange(bloc, change);
    super.onChange(bloc, change);
  }

  @override
  void onEvent(Bloc<dynamic, dynamic> bloc, Object? event) {
    delegate?.onEvent(bloc, event);
    super.onEvent(bloc, event);
  }

  @override
  void onError(BlocBase<dynamic> bloc, Object error, StackTrace stackTrace) {
    delegate?.onError(bloc, error, stackTrace);
    super.onError(bloc, error, stackTrace);
  }

  @override
  void onCreate(BlocBase<dynamic> bloc) {
    delegate?.onCreate(bloc);
    super.onCreate(bloc);
  }

  @override
  void onClose(BlocBase<dynamic> bloc) {
    delegate?.onClose(bloc);
    super.onClose(bloc);
  }

  @override
  void onTransition(
    Bloc<dynamic, dynamic> bloc,
    Transition<dynamic, dynamic> transition,
  ) {
    delegate?.onTransition(bloc, transition);
    super.onTransition(bloc, transition);
  }
}
