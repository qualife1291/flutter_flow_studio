# Flutter Flow Studio

A local Flutter flow explorer: a Dart CLI scans `lib/`, serves a bundled React Studio, and accepts opt-in runtime events over WebSocket. Studio offers developer, business analyst, tester, and low-code views. It does not require Node.js to run the bundled UI.

## Install from this repository

This repository has not been published to pub.dev. Add it to a Flutter application's `pubspec.yaml`:

```yaml
dependencies:
  flutter_flow_studio:
    git:
      url: https://github.com/qualife1291/flutter_flow_studio.git
      ref: main
```

Use Flutter **3.32.8 or later**, Dart **3.8 or later**. Run `flutter pub get`, then, from the application directory:

```sh
dart run flutter_flow_studio
```

Open the address printed by the CLI and paste its token into Studio. The default bind address is `127.0.0.1:8642`. Each CLI invocation creates a fresh random token. For a physical phone on your trusted LAN, use `--host 0.0.0.0` and configure the runtime host to the developer machine's LAN IP.

```sh
dart run flutter_flow_studio --project /path/to/app --port 8642
dart run flutter_flow_studio --export flow.mmd --business
dart run flutter_flow_studio --export flow.drawio
```

Supported CLI export suffixes: `.json`, `.mmd`, `.drawio`, `.puml`. Studio additionally exports Excalidraw, PNG at 2×, SVG, and `.flow.json` snapshots. Studio can import its own snapshots. Scope and role labels are selectable. API bodies are excluded by default, and the default runtime/server never collect them.

## Connect a debug application

```dart
import 'package:flutter/material.dart';
import 'package:flutter_flow_studio/flutter_flow_studio.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const token = String.fromEnvironment('STUDIO_TOKEN');
  if (token.isNotEmpty) {
    await FlutterFlowStudio.init(token: token);
  }
  runApp(MaterialApp(
    navigatorObservers: [FlowStudioNavigatorObserver()],
    home: const MyHomeScreen(),
  ));
}
```

Start the app with `flutter run --dart-define=STUDIO_TOKEN=<token-from-cli>`. Supply `host:` when the defaults below do not reach your CLI. Call `FlutterFlowStudio.dispose()` when terminating a runtime session. `init()` returns immediately in release builds without creating a connection, timer, or HTTP override.

| App platform | Default host | Runtime capture |
| --- | --- | --- |
| Android emulator | `10.0.2.2` | Navigator, Dart `HttpClient`, optional Dio/BLoC/Riverpod observers |
| iOS Simulator | `127.0.0.1` | Same Dart IO capture |
| Web | `127.0.0.1` | Navigator, explicit probes and observers; use Dio interceptor for fetch/XHR |
| Windows | `127.0.0.1` | Same Dart IO capture |

Physical Android/iOS devices use the developer machine's LAN IP. macOS/Linux use the Dart IO implementation as well. An HTTPS web application needs a reachable `wss` endpoint (`secure: true`) to avoid mixed-content blocking; the built-in server provides plain HTTP/WS, so use a TLS reverse proxy when needed.

Android debug builds need Internet permission and may need a debug-only `android:usesCleartextTraffic="true"` application setting for LAN HTTP/WS. iOS may need a development-only ATS exception and local network permission description. Avoid broad exceptions in production. Windows must allow the selected inbound port through its firewall when binding to LAN. See [platform behavior](docs/platforms.md) and [security](SECURITY.md).

For Dio, add `FlowStudioDioInterceptor()` to `dio.interceptors`; to avoid duplicate native Dio events use `captureHttp: false` in `init`. `FlowStudioBlocObserver(delegate: yourObserver)` records changes and forwards lifecycle callbacks. Register `FlowStudioProviderObserver()` through Riverpod's `ProviderScope(observers: [...])`.

Name routes/dialogs with `RouteSettings(name: ...)` to help event matching. Ambiguous events remain unassigned; use the node ID shown in the inspector for precise mapping:

```dart
FlowStudio.step('STATE_EMITTED', matchedNodeId: 'node-id-from-inspector');
FlowProbe.hit('decision-id-from-inspector:true_branch');
```

## Reading the graph

Static nodes use six semantic colors. Green is reserved for executed or inferred paths. `Inferred` means a unique static path could connect two observed events; it **does not** increase confirmed branch coverage. `Tested` requires a matching `BRANCH_HIT`. `Untested` has no probe evidence. Ambiguous paths are not inferred. “Theo bước” follows the currently matched runtime node; manually panning pauses it. “Tiêu điểm” highlights the selected neighborhood and observed path. Reduced-motion preferences disable camera animation and edge animation. Confirmed edges and timeline entries show their actual sequence numbers. Timeline history is bounded to 2,000 events; reconnecting runtimes retain a bounded offline queue of 256 events.

`// Flow: ...` or `/// @flow: ...` before a declaration/condition supplies a business label. Otherwise the translator expands identifiers and common HTTP/null/boolean expressions. This is a syntax-based analyzer; read the [limitations](docs/limitations.md) before interpreting its graph as a complete call graph.

`--deep-trace` instruments braced sink-related `if/else` branches only. Commit target files first. The CLI refuses dirty files, keeps original bytes under `.dart_tool/flow_studio_backups`, and restores on SIGINT/SIGTERM. If a traced file is edited, restore refuses to overwrite that edit and prints the backup path. A hard kill cannot run cleanup; recover backups before tracing again. Re-scan after source edits because node IDs include source positions.

## Develop and test

```sh
flutter pub get
flutter analyze
flutter test
(cd packages/cli && dart pub get && dart test)
(cd example && flutter pub get && flutter test && flutter build web)
(cd web_studio && npm ci && npm test && npm run build && npm run test:e2e)
```

`npm run build` copies production assets into `lib/src/web_assets/`; commit those assets together with UI changes. Frontend development uses `npm run dev` in `web_studio/` and a CLI on port 8642. `?demo=1` loads a checked-in graph generated by scanning `example/` for offline UI validation. `scripts/check-sdk.sh /path/to/flutter version-label` runs the SDK checks and writes logs. It cleans generated Flutter build state when switching SDKs.

The example uses an in-process Dio adapter to simulate successful and failed login responses without external credentials or Internet services. Its widget tests exercise error dialog, retry, home, and logout. Device integration tests live in `example/integration_test/`. CI defines Android, iOS, Windows, and web builds and Android/iOS device tests; configured jobs are not proof that a particular run passed.
