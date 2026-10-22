import 'package:flutter_test/flutter_test.dart';
import 'package:flow_studio_example/main.dart';

void main() {
  testWidgets('login success -> home -> logout', (tester) async {
    await tester.pumpWidget(const ExampleApp());
    await tester.tap(find.text('Đăng nhập').last);
    await tester.pumpAndSettle();
    expect(find.text('Trang chủ'), findsOneWidget);
    await tester.tap(find.text('Đăng xuất'));
    await tester.pumpAndSettle();
    expect(find.text('Flow Studio · Login'), findsOneWidget);
  });
  testWidgets('failed login opens recoverable error dialog', (tester) async {
    await tester.pumpWidget(const ExampleApp());
    await tester.tap(find.text('Mô phỏng sai mật khẩu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Đăng nhập').last);
    await tester.pumpAndSettle();
    expect(find.text('Đăng nhập thất bại'), findsOneWidget);
    await tester.tap(find.text('Đóng'));
    await tester.pumpAndSettle();
    expect(find.text('Đăng nhập thất bại'), findsNothing);
  });
}
