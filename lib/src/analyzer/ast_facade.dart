// The older API is required on analyzer 6–7 at the supported SDK floor.
// ignore_for_file: deprecated_member_use
import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';

/// All analyzer integration uses stable syntax APIs; no version-specific elements.
class AstFacade {
  CompilationUnit parse(String source, String path) {
    final result = parseString(
      content: source,
      path: path,
      throwIfDiagnostics: false,
    );
    // Stable across analyzer 6–8; newer diagnostic APIs do not exist on the SDK floor.
    final errors = result.errors.where(
      (e) => e.errorCode.errorSeverity.name == 'ERROR',
    );
    if (errors.isNotEmpty)
      throw FormatException('Dart parse errors in $path: ${errors.join(', ')}');
    return result.unit;
  }
}
