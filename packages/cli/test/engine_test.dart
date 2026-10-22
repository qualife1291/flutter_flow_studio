import 'dart:convert';
import 'dart:io';
import 'package:test/test.dart';
import '../../../lib/src/analyzer/ast_pipeline.dart';
import '../../../lib/src/analyzer/human_readable_translator.dart';
import '../../../lib/src/analyzer/deep_trace_instrumenter.dart';
import '../../../lib/src/schema/graph_models.dart';
import '../../../lib/src/server/cli_exporters.dart';

void main() {
  late Directory root;
  setUp(() {
    root = Directory.systemTemp.createTempSync('flow_test_');
    Directory('${root.path}/lib').createSync();
    File('${root.path}/pubspec.yaml').writeAsStringSync(
      'name: sample\nversion: 1.0.0\nenvironment:\n  sdk: ">=3.8.0 <4.0.0"\ndependencies:\n  dio: ^5.7.0\n',
    );
  });
  tearDown(() => root.deleteSync(recursive: true));
  FlowGraphPayload scan(String source) {
    File('${root.path}/lib/main.dart').writeAsStringSync(source);
    return AstPipeline().scan(root.path);
  }

  test('filters UI-only branches while preserving sink branches', () {
    final g = scan('''class LoginScreen extends StatelessWidget {
    Widget build(context) { if (loading) { return Text('loading'); } else { return Container(); } }
    void login() { if (ok) { dio.post('/login'); } else { showDialog(context: context); } }
  }''');
    expect(g.nodes.where((n) => n.kind == 'DECISION'), hasLength(1));
    expect(g.nodes.where((n) => n.kind == 'API'), hasLength(1));
    expect(g.nodes.where((n) => n.kind == 'DIALOG'), hasLength(1));
    expect(
      g.edges.where((e) => e.data['sourceHandle'] == 'true_branch'),
      hasLength(1),
    );
    expect(
      g.edges.where((e) => e.data['sourceHandle'] == 'false_branch'),
      hasLength(1),
    );
  });
  test('sink IDs and wire models round-trip deterministically', () {
    final g = scan("void load(){ dio.get('/a'); }");
    final h = AstPipeline().scan(root.path);
    expect(g.nodes.map((n) => n.id), h.nodes.map((n) => n.id));
    expect(
      FlowGraphPayload.fromJson(jsonDecode(jsonEncode(g.toJson()))).toJson(),
      g.toJson(),
    );
  });
  test('try/catch and fold keep their distinct branches', () {
    final g = scan(
      "void load(){ try { dio.get('/a'); } catch(e) { showDialog(); } result.fold((e){showDialog();},(v){dio.post('/b');}); }",
    );
    expect(
      g.nodes.where((n) => n.decisionInfo?['kind'] == 'TRY_CATCH'),
      hasLength(1),
    );
    expect(
      g.nodes.where((n) => n.decisionInfo?['kind'] == 'EITHER_FOLD'),
      hasLength(1),
    );
    expect(g.edges.any((e) => e.data['sourceHandle'] == 'catch_0'), isTrue);
    expect(g.edges.any((e) => e.data['sourceHandle'] == 'branch_1'), isTrue);
  });
  test('switch cases and default retain separate handles', () {
    final g = scan(
      "void load(){switch(state){case 1: dio.get('/a'); break; default: showDialog();}}",
    );
    expect(g.nodes.where((n) => n.kind == 'DECISION'), hasLength(1));
    expect(
      g.edges.map((e) => e.data['sourceHandle']),
      containsAll(['case_0', 'case_1']),
    );
  });
  test('does not classify collection get or push as API/navigation', () {
    final g = scan("void load(){ values.get('a'); queue.push(1); }");
    expect(g.nodes, isEmpty);
  });
  test('detects logout and does not warn about handled API', () {
    final g = scan(
      "void load(){ try { dio.get('/a'); } catch(e) { signOut(); } }",
    );
    expect(g.nodes.any((n) => n.kind == 'LOGOUT'), isTrue);
    expect(
      g.healthIssues.where((i) => i.data['category'] == 'UNHANDLED_API_ERROR'),
      isEmpty,
    );
  });
  test('warns missing else but respects a following fallback sink', () {
    var g = scan("void load(){if(ok){dio.get('/a');}}");
    expect(
      g.healthIssues.any((i) => i.data['category'] == 'MISSING_ELSE_BRANCH'),
      isTrue,
    );
    g = scan("void load(){if(ok){dio.get('/a');} showDialog();}");
    expect(
      g.healthIssues.where((i) => i.data['category'] == 'MISSING_ELSE_BRANCH'),
      isEmpty,
    );
  });
  test('unambiguous calls connect across methods; ambiguous calls do not', () {
    final g = scan(
      "class A {void run(){repo.load();} void load(){dio.get('/a');}} class B {void load(){dio.post('/b');}}",
    );
    final run = g.nodes.where((n) => n.technicalTitle == 'A.run()');
    expect(run, isEmpty);
  });
  test('typed state emissions connect to matching listeners', () {
    final g = scan(
      "void load(){emit(LoginSuccess());} void listener(){if(state is LoginSuccess){showDialog();}}",
    );
    expect(g.edges.any((e) => e.data['isStateBridge'] == true), isTrue);
  });
  test('dependency inspection categorizes direct dependencies', () {
    final g = scan("void load(){dio.get('/a');}");
    expect(
      (g.project['allDependencies'] as List).single['category'],
      'NETWORK',
    );
    expect(g.project['detectedArchitecture']['networking'], ['dio (^5.7.0)']);
  });
  test('parser errors stop scan with an actionable error', () {
    expect(() => scan('void {'), throwsFormatException);
  });
  test('translation honors annotation and HTTP expressions', () {
    final t = HumanReadableTranslator();
    expect(t.translate('login', comment: '/// @flow: Đăng nhập'), 'Đăng nhập');
    expect(
      t.translate('res.statusCode == 200 && user.isNotEmpty'),
      contains('API Thành công (HTTP 200) VÀ'),
    );
  });
  test('exporters escape user labels and preserve graph structure', () {
    final g = scan("void load(){dio.get('/a');}");
    for (final format in ['json', 'mmd', 'puml', 'drawio'])
      expect(exportGraph(g, format), isNotEmpty);
    expect(exportGraph(g, 'drawio'), contains('<mxCell'));
    expect(() => exportGraph(g, 'exe'), throwsArgumentError);
  });
  test('deep trace refuses an uncommitted source file', () {
    scan('void load(){if(ok){dio.get("/a");}}');
    Process.runSync('git', ['init', root.path]);
    expect(
      () => DeepTraceInstrumenter().instrument(root.path),
      throwsStateError,
    );
  });
  test('deep trace restores exact original bytes', () {
    final source = 'void load(){if(ok){dio.get("/a");}}';
    scan(source);
    Process.runSync('git', ['init', root.path]);
    Process.runSync('git', ['-C', root.path, 'add', '.']);
    final committed = Process.runSync('git', [
      '-C',
      root.path,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-m',
      'fixture',
    ]);
    expect(committed.exitCode, 0);
    final instrumenter = DeepTraceInstrumenter();
    instrumenter.instrument(root.path);
    expect(
      File('${root.path}/lib/main.dart').readAsStringSync(),
      contains('FlowProbe.hit('),
    );
    instrumenter.restore();
    expect(File('${root.path}/lib/main.dart').readAsStringSync(), source);
  });

  test('locally typed clients and annotated API declarations are detected', () {
    final g = scan(
      "class Api { @POST('/login') Future<void> login(); } void load(){ final network = Dio(); network.get('/a'); }",
    );
    expect(g.nodes.where((n) => n.kind == 'API'), hasLength(2));
    expect(
      g.nodes
          .where((n) => n.kind == 'API')
          .map((n) => n.data['apiInfo']['endpoint']),
      containsAll(['/login', '/a']),
    );
  });
  test('BLoC event callbacks link dispatch to guarded state emissions', () {
    final g = scan(
      "class AuthBloc { AuthBloc(){on<LoginEvent>((event,emit){if(ok){emit(LoginSuccess());}});} } void trigger(){bloc.add(LoginEvent());} void listen(){if(state is LoginSuccess){showDialog();}}",
    );
    final trigger = g.nodes.firstWhere((n) => n.technicalTitle == 'trigger()');
    expect(g.edges.any((e) => e.source == trigger.id), isTrue);
    expect(g.edges.any((e) => e.data['isStateBridge'] == true), isTrue);
  });
  test(
    'deep trace preserves library directives and refuses to overwrite user edits',
    () {
      final source = 'library sample; void load(){if(ok){dio.get("/a");}}';
      scan(source);
      Process.runSync('git', ['init', root.path]);
      Process.runSync('git', ['-C', root.path, 'add', '.']);
      Process.runSync('git', [
        '-C',
        root.path,
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        'commit',
        '-m',
        'fixture',
      ]);
      final trace = DeepTraceInstrumenter();
      trace.instrument(root.path);
      final file = File('${root.path}/lib/main.dart');
      expect(file.readAsStringSync().startsWith('library sample;'), isTrue);
      file.writeAsStringSync('${file.readAsStringSync()} // user edit');
      expect(() => trace.restore(), throwsStateError);
      expect(file.readAsStringSync(), endsWith('// user edit'));
    },
  );

  test('deep trace refuses part files without changing source', () {
    const source = 'part of sample; void load(){if(ok){dio.get("/a");}}';
    scan(source);
    Process.runSync('git', ['init', root.path]);
    Process.runSync('git', ['-C', root.path, 'add', '.']);
    Process.runSync('git', [
      '-C',
      root.path,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-m',
      'fixture',
    ]);
    expect(
      () => DeepTraceInstrumenter().instrument(root.path),
      throwsStateError,
    );
    expect(File('${root.path}/lib/main.dart').readAsStringSync(), source);
  });
}
