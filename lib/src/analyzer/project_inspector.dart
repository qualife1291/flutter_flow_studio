import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:yaml/yaml.dart';
import '../schema/graph_models.dart';

class ProjectInspector {
  static const groups = {
    'STATE': [
      'bloc',
      'flutter_bloc',
      'riverpod',
      'flutter_riverpod',
      'provider',
      'get',
      'mobx',
      'signals',
    ],
    'ROUTER': ['go_router', 'auto_route', 'beamer'],
    'NETWORK': [
      'dio',
      'http',
      'retrofit',
      'chopper',
      'graphql',
      'graphql_flutter',
      'supabase_flutter',
    ],
    'STORAGE': [
      'shared_preferences',
      'flutter_secure_storage',
      'hive',
      'sqflite',
    ],
    'DI': ['get_it', 'injectable'],
  };
  Json inspect(String directory) {
    final manifest = File(p.join(directory, 'pubspec.yaml'));
    if (!manifest.existsSync())
      throw ArgumentError('No pubspec.yaml in $directory');
    final pub = loadYaml(manifest.readAsStringSync()) as YamlMap;
    final lock = File(p.join(directory, 'pubspec.lock'));
    final locked = lock.existsSync()
        ? (loadYaml(lock.readAsStringSync()) as YamlMap)['packages'] as YamlMap?
        : null;
    final deps = <String, Json>{};
    void add(String name, String version, bool direct, bool dev) {
      final category = dev
          ? 'DEV'
          : groups.entries
                    .where((e) => e.value.contains(name))
                    .map((e) => e.key)
                    .firstOrNull ??
                'UI_UTILS';
      deps[name] = {
        'name': name,
        'version': version,
        'category': category,
        'isDirect': direct,
      };
    }

    for (final section in ['dependencies', 'dev_dependencies']) {
      final values = pub[section];
      if (values is Map) {
        for (final key in values.keys) {
          add(
            key.toString(),
            locked?[key]?['version']?.toString() ?? values[key].toString(),
            true,
            section == 'dev_dependencies',
          );
        }
      }
    }
    if (locked != null) {
      for (final key in locked.keys) {
        if (!deps.containsKey(key))
          add(key.toString(), locked[key]['version'].toString(), false, false);
      }
    }
    String sdk = 'unknown';
    final config = File(p.join(directory, '.dart_tool', 'package_config.json'));
    if (config.existsSync()) {
      final data = jsonDecode(config.readAsStringSync()) as Json;
      sdk = data['flutterVersion']?.toString() ?? 'unknown';
    }
    return {
      'projectRoot': p.absolute(directory).replaceAll('\\', '/'),
      'projectName': pub['name']?.toString() ?? p.basename(directory),
      'description': pub['description']?.toString() ?? '',
      'version': pub['version']?.toString() ?? 'unversioned',
      'flutterSdkVersion': sdk,
      'dartSdkConstraint': pub['environment']?['sdk']?.toString() ?? 'unknown',
      'detectedArchitecture': {
        for (final entry in {
          'stateManagement': 'STATE',
          'routing': 'ROUTER',
          'networking': 'NETWORK',
          'localStorage': 'STORAGE',
        }.entries)
          entry.key: deps.values
              .where((d) => d['category'] == entry.value)
              .map((d) => '${d['name']} (${d['version']})')
              .toList(),
      },
      'allDependencies': deps.values.toList(),
      'stats': <String, int>{},
    };
  }
}
