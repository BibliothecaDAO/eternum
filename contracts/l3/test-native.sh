#!/usr/bin/env bash
set -euo pipefail

export RAYON_NUM_THREADS=1
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/world-native/tests"
unset SCARB_MANIFEST_PATH SCARB_TARGET_DIR
exec snforge test --package 'world_tests_*' --max-threads 1 "$@"
