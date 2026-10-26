#!/usr/bin/env bash
set -euo pipefail

export RAYON_NUM_THREADS=1
native=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
unset SCARB_MANIFEST_PATH SCARB_TARGET_DIR
cd "$native/world-native/tests"
exec snforge test --package 'world_tests_*' --max-threads 1 "$@"
