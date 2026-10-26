#!/usr/bin/env bash
set -euo pipefail

export RAYON_NUM_THREADS=1
native=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
runner=$(python3 "$native/world-native/toolchain/snforge.py" resolve)
unset SCARB_MANIFEST_PATH SCARB_TARGET_DIR
cd "$native/world-native/tests"
exec "$runner" test --package 'world_tests_*' --max-threads 1 "$@"
