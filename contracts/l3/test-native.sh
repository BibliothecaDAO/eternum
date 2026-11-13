#!/usr/bin/env bash
set -euo pipefail

export RAYON_NUM_THREADS=1
native=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
runner=$(python3 "$native/world-native/toolchain/snforge.py" resolve)
unset SCARB_MANIFEST_PATH SCARB_TARGET_DIR
cd "$native/world-native/tests"
package="world_tests_*"
if [[ "${1:-}" == "--package" ]]; then
  package=$2
  shift 2
fi
threads=1
if [[ "$package" == "world_tests_discovery_roots" ]]; then
  threads=4
fi
exec "$runner" test --package "$package" --max-threads "$threads" "$@"
