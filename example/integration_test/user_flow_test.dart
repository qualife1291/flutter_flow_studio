import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flow_studio_example/main.dart' as app;

Future<void> waitFor(WidgetTester tester, Finder finder) async {
  final deadline = DateTime.now().add(const Duration(seconds: 15));
  while (finder.evaluate().isEmpty && DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  expect(finder, findsOneWidget);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('Login -> API -> failure dialog -> retry -> Home -> Logout', (
    tester,
  ) async {
    app.main();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mô phỏng sai mật khẩu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Đăng nhập').last);
    await tester.pumpAndSettle();
    await waitFor(tester, find.text('Đăng nhập thất bại'));
    await tester.tap(find.text('Đóng'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mô phỏng sai mật khẩu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Đăng nhập').last);
    await tester.pumpAndSettle();
    await waitFor(tester, find.text('Trang chủ'));
    await tester.tap(find.text('Đăng xuất'));
    await tester.pumpAndSettle();
    await waitFor(tester, find.text('Flow Studio · Login'));
  });
}
