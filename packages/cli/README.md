# CLI test harness

Run `dart pub get && dart test` here using the Dart SDK bundled with the Flutter version under test. Tests import the CLI engine from the repository and exercise the same source shipped by the root package, without importing Flutter widget libraries. This harness is not a separately published package. The executable remains `dart run flutter_flow_studio` from a consuming Flutter application.
