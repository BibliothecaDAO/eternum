#!/usr/bin/env bash
# Summarizes Madara's per-block `close_block_complete` JSON log lines for the lab container.
#
#   deploy/madara-lab/scripts/block-stats.sh
#   deploy/madara-lab/scripts/block-stats.sh --since 2026-08-26T10:00:00Z --until 2026-08-26T10:10:00Z
#   deploy/madara-lab/scripts/block-stats.sh --since 10m --json
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="${MADARA_CONTAINER:-madara-lab}"
DOCKER_ARGS=(logs "$CONTAINER")
PYTHON_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since|--until)
      [[ $# -ge 2 ]] || { echo "missing value for $1" >&2; exit 2; }
      DOCKER_ARGS+=("$1" "$2")
      shift 2
      ;;
    --json)
      PYTHON_ARGS+=(--json)
      shift
      ;;
    *)
      if [[ "$1" == -* ]]; then
        echo "unknown option: $1" >&2
        exit 2
      fi
      DOCKER_ARGS+=(--since "$1")
      shift
      ;;
  esac
done

docker "${DOCKER_ARGS[@]}" 2>&1 | python3 "$SCRIPT_DIR/block-stats.py" "${PYTHON_ARGS[@]}"
