# Platforms

| Capability | Android | iOS | Web | Windows |
| --- | --- | --- | --- | --- |
| Navigator observer (push/pop/replace and popup routes) | Implemented | Implemented | Implemented | Implemented |
| Automatic Dart `HttpClient` metadata | Implemented | Implemented | Unavailable (`dart:io` is conditionally excluded) | Implemented |
| Dio interceptor | Implemented | Implemented | Implemented | Implemented |
| BLoC/Riverpod observers and explicit probes | Implemented | Implemented | Implemented | Implemented |
| Release no-op | Implemented | Implemented | Implemented | Implemented |
| Default CLI host from app | `10.0.2.2` on emulator | `127.0.0.1` on simulator | `127.0.0.1` | `127.0.0.1` |

“Implemented” describes the available code paths, not a claim of device certification. Validation evidence and outstanding device/build checks are recorded separately in `progress/HANDOVER.md`.

A `PopupRoute` is reported as a dialog; a `ModalBottomSheetRoute` is reported as a bottom sheet. Snackbars are not Navigator routes: send an explicit `SNACKBAR_SHOW` event if runtime snackbar tracking is required. Route names improve matching. Runtime does not serialize route arguments.

Dart IO capture covers clients created after initialization through the isolate's active `HttpOverrides`. It does not instrument already-created clients, other isolates, native network stacks, Cronet, or `cupertino_http`. Existing global overrides are chained; zone-local overrides take precedence over global capture. Dispose restores the previous override if Studio still owns the global override.

On Web, the native override module is replaced at compile time by a stub. Use Dio interception or explicit probes for networking. Browser same-origin and mixed-content policies still apply. WebSocket delivery is best effort and not an audit log.

Linux/macOS desktop share the Dart IO runtime. The CLI itself uses Dart IO and must run on a development host, not in the browser. iOS builds need macOS/Xcode; Windows builds need Windows/Visual Studio; Android builds need a JDK and Android SDK with accepted licenses.
