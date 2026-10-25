#!/usr/bin/env bash
set -euo pipefail

exec snforge test --max-threads 1 "$@"
