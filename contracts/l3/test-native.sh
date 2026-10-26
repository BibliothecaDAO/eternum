#!/usr/bin/env bash
set -euo pipefail

export RAYON_NUM_THREADS=1
exec snforge test --max-threads 1 "$@"
