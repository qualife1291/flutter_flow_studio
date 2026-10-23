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
    expect(
      g.edges.map((e) => e.data['technicalLabel']),
      contains('catch (Exception)'),
    );
    expect(g.edges.map((e) => e.data['businessLabel']), contains('Thành công'));
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
    expect(
      g.edges.map((e) => e.data['technicalLabel']),
      containsAll(['case 1', 'default']),
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
    expect(g.nodes.any((n) => n.kind == 'LOGOUT'), isFalse);
    expect(
      g.nodes.any(
        (n) => n.kind == 'ACTION' && n.technicalTitle.contains('signOut'),
      ),
      isTrue,
    );
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
      "class Api { @POST('/login') Future<void> login(); @Get(path:'/chopper') Future<void> fetch(); } void load(){ final network = Dio(); network.get('/a'); }",
    );
    expect(g.nodes.where((n) => n.kind == 'API'), hasLength(3));
    expect(
      g.nodes
          .where((n) => n.kind == 'API')
          .map((n) => n.data['apiInfo']['endpoint']),
      containsAll(['/login', '/a', '/chopper']),
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

  test('copyWith status predicates bridge to matching listeners', () {
    final g = scan(
      "void load(){emit(state.copyWith(status: Status.failure));} void listener(){if(state.status == Status.failure){showDialog();}}",
    );
    expect(g.edges.any((e) => e.data['isStateBridge'] == true), isTrue);
  });
  test(
    'notifier state assignments expose runtime-matchable state constructor names',
    () {
      final g = scan(
        "void load(){state=AsyncData(value);} void listener(){if(next is AsyncData){showDialog();}}",
      );
      expect(g.nodes.any((n) => n.technicalTitle == 'AsyncData'), isTrue);
      expect(g.edges.any((e) => e.data['isStateBridge'] == true), isTrue);
    },
  );

  test('GoRouter paths and names resolve across source files', () {
    File('${root.path}/lib/screens.dart').writeAsStringSync(
      'class Dashboard extends StatelessWidget { Widget build(context)=>Text("home"); }',
    );
    final g = scan(
      "final routes=[GoRoute(path:'/home/:id',name:'home',builder:(context,state)=>Dashboard())]; void open(){context.goNamed('home');}",
    );
    final screen = g.nodes.singleWhere((n) => n.technicalTitle == 'Dashboard');
    expect(screen.data['routeInfo']['routePath'], '/home/:id');
    expect(g.edges.any((e) => e.target == screen.id), isTrue);
  });
  test('Material named routes and custom widget destinations are linked', () {
    final g = scan(
      "class Dashboard extends StatelessWidget { Widget build(context)=>Text('home'); } final app=MaterialApp(routes:{'/home':(_)=>Dashboard()}); void open(){Navigator.pushNamed(context,'/home');}",
    );
    final screen = g.nodes.singleWhere((n) => n.technicalTitle == 'Dashboard');
    expect(g.edges.any((e) => e.target == screen.id), isTrue);
  });

  test('UI-only loading emissions do not retain branches or warnings', () {
    final g = scan(
      "void render(){if(loading){emit(Loading());} else {emit(Idle());}}",
    );
    expect(g.nodes, isEmpty);
    expect(g.healthIssues, isEmpty);
  });

  test('an API response leads to the subsequent business decision', () {
    final g = scan(
      "void login()async{final result=await dio.post('/login');if(result.ok){showDialog();}}",
    );
    final api = g.nodes.singleWhere((n) => n.kind == 'API');
    final decision = g.nodes.singleWhere((n) => n.kind == 'DECISION');
    expect(
      g.edges.any((e) => e.source == api.id && e.target == decision.id),
      isTrue,
    );
    final method = g.nodes.singleWhere((n) => n.technicalTitle == 'login()');
    expect(
      g.edges.any((e) => e.source == method.id && e.target == decision.id),
      isFalse,
    );
  });
  test('overlays have distinct kinds and preserve sequential links', () {
    final g = scan(
      "void run()async{await showDialog();showModalBottomSheet();showSnackBar();showToast();dio.get('/next');}",
    );
    expect(
      g.nodes.map((n) => n.kind),
      containsAll(['DIALOG', 'BOTTOMSHEET', 'SNACKBAR', 'TOAST', 'API']),
    );
    final dialog = g.nodes.singleWhere((n) => n.kind == 'DIALOG');
    final sheet = g.nodes.singleWhere((n) => n.kind == 'BOTTOMSHEET');
    expect(
      g.edges.any(
        (e) =>
            e.source == dialog.id &&
            e.target == sheet.id &&
            e.data['kind'] == 'SEQUENCE',
      ),
      isTrue,
    );
    expect(g.project['stats'].containsKey('totalLogoutPoints'), isFalse);
  });
  test(
    'source contexts contain the exact full function once for multiple nodes',
    () {
      const function =
          "Future<void> run() async {\n  await dio.get('/a');\n  showDialog();\n}";
      final g = scan(function);
      expect(g.sourceContexts, hasLength(1));
      expect(g.sourceContexts.values.single['code'], function);
      expect(g.sourceContexts.values.single['endLine'], 4);
      expect(
        g.nodes.every(
          (n) => g.sourceContexts.containsKey(
            n.data['sourceLocation']['contextId'],
          ),
        ),
        isTrue,
      );
      final restored = FlowGraphPayload.fromJson(
        jsonDecode(jsonEncode(g.toJson())),
      );
      expect(restored.sourceContexts, g.sourceContexts);
    },
  );
  test(
    'nested GoRouter paths and named Material routes expose router metadata',
    () {
      final g = scan(
        "class ProductScreen extends StatelessWidget {Widget build(c)=>Text('product');} final router=GoRouter(routes:[GoRoute(path:'/shop',builder:(c,s)=>ProductScreen(),routes:[GoRoute(path:'product/:id',name:'product',builder:(c,s)=>ProductScreen())])]); void open(){context.go('/shop/product/1');}",
      );
      final screen = g.nodes.singleWhere((n) => n.kind == 'SCREEN');
      expect(
        screen.data['routeInfo']['aliases'],
        contains('/shop/product/:id'),
      );
      expect(screen.data['routeInfo']['router'], 'GoRouter');
      final h = scan(
        "class HomeScreen extends StatelessWidget {Widget build(c)=>Text('home');} void open(){Navigator.push(context,MaterialPageRoute(settings:RouteSettings(name:'/home'),builder:(c)=>HomeScreen()));}",
      );
      final home = h.nodes.singleWhere((n) => n.kind == 'SCREEN');
      expect(home.data['routeInfo']['routePath'], '/home');
      expect(
        h.edges.any(
          (e) => e.target == home.id && e.data['kind'] == 'NAVIGATION',
        ),
        isTrue,
      );
    },
  );
  test(
    'typed repository calls with colliding names return to caller decisions',
    () {
      final g = scan(
        "class Api {Future load(){return dio.get('/a');}} class Controller {final Api api=Api();Future load()async{final result=await api.load();if(result.ok){showDialog();}}}",
      );
      final api = g.nodes.singleWhere((n) => n.kind == 'API');
      final decision = g.nodes.singleWhere((n) => n.kind == 'DECISION');
      expect(
        g.edges.any((e) => e.source == api.id && e.target == decision.id),
        isTrue,
      );
      final caller = g.nodes.singleWhere(
        (n) => n.technicalTitle == 'Controller.load()',
      );
      final callee = g.nodes.singleWhere(
        (n) => n.technicalTitle == 'Api.load()',
      );
      expect(
        g.edges.any((e) => e.source == caller.id && e.target == callee.id),
        isTrue,
      );
    },
  );
}
