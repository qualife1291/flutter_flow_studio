#!/usr/bin/env bash
set -euo pipefail
repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
flutter_bin=${1:-flutter}
dart_bin="$(dirname "$(command -v "$flutter_bin")")/dart"
label=${2:-current}
log_dir="$repo_root/docs/progress/logs/$label"
mkdir -p "$log_dir"
"$flutter_bin" --version 2>&1 | tee "$log_dir/version.txt"
cd "$repo_root"
"$flutter_bin" clean > "$log_dir/runtime-clean.txt" 2>&1
"$flutter_bin" pub get 2>&1 | tee "$log_dir/runtime-pub.txt"
"$flutter_bin" analyze 2>&1 | tee "$log_dir/analyze.txt"
"$flutter_bin" test 2>&1 | tee "$log_dir/runtime-test.txt"
cd "$repo_root/packages/cli"
"$dart_bin" pub get 2>&1 | tee "$log_dir/cli-pub.txt"
"$dart_bin" test 2>&1 | tee "$log_dir/cli-test.txt"
cd "$repo_root/example"
"$flutter_bin" clean > "$log_dir/example-clean.txt" 2>&1
"$flutter_bin" pub get 2>&1 | tee "$log_dir/example-pub.txt"
"$flutter_bin" analyze 2>&1 | tee "$log_dir/example-analyze.txt"
"$flutter_bin" test 2>&1 | tee "$log_dir/example-test.txt"
"$flutter_bin" build web --no-web-resources-cdn 2>&1 | tee "$log_dir/web-build.txt"
