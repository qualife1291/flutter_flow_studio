import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_flow_studio/flutter_flow_studio.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const token = String.fromEnvironment('STUDIO_TOKEN');
  if (token.isNotEmpty) await FlutterFlowStudio.init(token: token);
  runApp(const ExampleApp());
}

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Flow Studio Example',
    navigatorObservers: [FlowStudioNavigatorObserver()],
    theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
    home: const LoginScreen(),
  );
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final dio = Dio(
    BaseOptions(validateStatus: (status) => status != null && status < 500),
  );
  bool busy = false;
  bool fail = false;
  // Flow: Đăng nhập và xử lý kết quả API
  Future<void> login() async {
    setState(() => busy = true);
    try {
      final response = await dio.post('/api/v1/login', data: {'fail': fail});
      if (!mounted) return;
      if (response.statusCode == 200) {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            settings: const RouteSettings(name: 'HomeScreen'),
            builder: (_) => const HomeScreen(),
          ),
        );
      } else {
        await showDialog<void>(
          context: context,
          routeSettings: const RouteSettings(name: 'LoginErrorDialog'),
          builder: (_) => AlertDialog(
            title: const Text('Đăng nhập thất bại'),
            content: const Text('Kiểm tra tài khoản và thử lại.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Đóng'),
              ),
            ],
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể kết nối. Vui lòng thử lại.')),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void initState() {
    super.initState();
    dio.httpClientAdapter = DemoAdapter();
    dio.interceptors.add(FlowStudioDioInterceptor());
  }

  @override
  void dispose() {
    dio.close(force: true);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Flow Studio · Login')),
    body: Center(
      child: SizedBox(
        width: 340,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Đăng nhập', style: TextStyle(fontSize: 28)),
            const SizedBox(height: 24),
            SwitchListTile(
              title: const Text('Mô phỏng sai mật khẩu'),
              value: fail,
              onChanged: busy ? null : (v) => setState(() => fail = v),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: busy ? null : login,
              child: Text(busy ? 'Đang xử lý…' : 'Đăng nhập'),
            ),
          ],
        ),
      ),
    ),
  );
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});
  void logout(BuildContext context) {
    FlowStudio.step('LOGOUT_TRIGGERED');
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(
        settings: const RouteSettings(name: 'LoginScreen'),
        builder: (_) => const LoginScreen(),
      ),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Trang chủ')),
    body: Center(
      child: FilledButton(
        onPressed: () => logout(context),
        child: const Text('Đăng xuất'),
      ),
    ),
  );
}

/// Deterministic in-process HTTP adapter. The example never sends credentials to the Internet.
class DemoAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 100));
    final fail = (options.data as Map?)?['fail'] == true;
    return ResponseBody.fromString(
      '{"ok":${!fail}}',
      fail ? 400 : 200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
