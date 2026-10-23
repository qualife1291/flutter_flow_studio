# Login flow example

This app demonstrates Login → API → success/failure → error dialog or Home → Logout. Its Dio adapter returns deterministic responses in process; it needs no backend, account, or credentials. Toggle **Mô phỏng sai mật khẩu** to exercise the failure branch, close the dialog, and retry.

```sh
flutter pub get
flutter run
```

To inspect runtime activity, start the CLI from the repository root:

```sh
dart run bin/flutter_flow_studio.dart --project example --host 0.0.0.0
```

Paste the fresh CLI token into Studio, then launch the example with `flutter run --dart-define=STUDIO_TOKEN=<token-from-cli>`. Native Dio interception is added explicitly in this app; its adapter is not a real network client. The runtime itself is disabled in release builds.

Android emulator defaults to Studio host `10.0.2.2`; iOS Simulator, Web and Windows default to `127.0.0.1`. A physical device needs the host machine's LAN address. Configure that host in `FlutterFlowStudio.init` in `lib/main.dart` for a physical-device session. The debug Android manifest permits local cleartext traffic; production applications should use their own network policy. For iOS ATS/local network settings and Windows firewall behavior, see the [repository README](../README.md) and [platform notes](../docs/platforms.md).

```sh
flutter analyze
flutter test
flutter build web
flutter build apk --debug
flutter test integration_test/user_flow_test.dart -d <device-id>
```

The integration test runs the failure dialog, successful retry, Home and Logout on Android emulator or iOS Simulator. iOS builds need macOS/Xcode, and Windows builds need Windows/Visual Studio. `lib/release_check.dart` is a separate release verification entrypoint used by the repository's browser no-socket check.
