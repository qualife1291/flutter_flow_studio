import 'dart:async';
import 'dart:io';
import 'dart:isolate';
import 'package:args/args.dart';
import 'package:path/path.dart' as p;
import 'package:flutter_flow_studio/src/analyzer/ast_pipeline.dart';
import 'package:flutter_flow_studio/src/analyzer/deep_trace_instrumenter.dart';
import 'package:flutter_flow_studio/src/server/studio_lan_server.dart';
import 'package:flutter_flow_studio/src/server/network_utils.dart';
import 'package:flutter_flow_studio/src/server/cli_exporters.dart';

Future<void> main(List<String> arguments) async {
  final parser = ArgParser()
    ..addOption('port', defaultsTo: '8642')
    ..addOption('host', defaultsTo: '127.0.0.1')
    ..addOption('project', defaultsTo: Directory.current.path)
    ..addOption('export', help: 'Output file: .json, .mmd, .drawio, .puml')
    ..addFlag('open', defaultsTo: false)
    ..addFlag('deep-trace', defaultsTo: false)
    ..addFlag('business', defaultsTo: false)
    ..addFlag('help', abbr: 'h', negatable: false);
  try {
    final args = parser.parse(arguments);
    if (args['help'] as bool) {
      stdout.writeln(parser.usage);
      return;
    }
    final root = p.normalize(p.absolute(args['project'] as String));
    final port = int.tryParse(args['port'] as String);
    if (port == null || port < 0 || port > 65535)
      throw ArgumentError('Port must be 0..65535');
    final graph = AstPipeline().scan(root);
    final output = args['export'] as String?;
    if (output != null) {
      File(output).writeAsStringSync(
        exportGraph(
          graph,
          p.extension(output).replaceFirst('.', ''),
          business: args['business'] as bool,
        ),
      );
      stdout.writeln('Exported ${graph.nodes.length} nodes to $output');
      return;
    }
    final uri = await Isolate.resolvePackageUri(
      Uri.parse('package:flutter_flow_studio/src/web_assets/index.html'),
    );
    final server = StudioLanServer(
      graph,
      assetsPath: uri == null ? null : p.dirname(uri.toFilePath()),
    );
    final trace = DeepTraceInstrumenter();
    if (args['deep-trace'] as bool) trace.instrument(root);
    try {
      await server.start(host: args['host'] as String, port: port);
    } catch (_) {
      trace.restore();
      rethrow;
    }
    final host = args['host'] as String;
    stdout.writeln(
      'Flow Studio: http://$host:${server.port}\nToken: ${server.token}\nNodes: ${graph.nodes.length}; warnings: ${graph.healthIssues.length}',
    );
    if (host == '0.0.0.0')
      stdout.writeln(
        'LAN addresses: ${(await lanAddresses()).join(', ')}. Only use trusted networks.',
      );
    if (args['open'] as bool) {
      final url =
          'http://${host == '0.0.0.0' ? '127.0.0.1' : host}:${server.port}';
      final command = Platform.isMacOS
          ? 'open'
          : Platform.isWindows
          ? 'explorer'
          : 'xdg-open';
      try {
        await Process.start(command, [url]);
      } catch (_) {
        stderr.writeln('Open $url in your browser.');
      }
    }
    final stopped = Completer<void>();
    final subscriptions = <StreamSubscription<ProcessSignal>>[];
    void stop(ProcessSignal _) {
      if (!stopped.isCompleted) stopped.complete();
    }

    subscriptions.add(ProcessSignal.sigint.watch().listen(stop));
    if (!Platform.isWindows)
      subscriptions.add(ProcessSignal.sigterm.watch().listen(stop));
    await stopped.future;
    await server.close();
    for (final s in subscriptions) {
      await s.cancel();
    }
    trace.restore();
  } catch (error) {
    stderr.writeln('Flow Studio: $error');
    exitCode = 1;
  }
}
