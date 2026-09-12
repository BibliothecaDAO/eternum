#!/usr/bin/env bash
# Build with Scarb, then deploy the world and write the existing manifest format.
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$LAB_DIR/../.." && pwd)"
GAME_DIR="$REPO_ROOT/contracts/l3/game"
export RPC_URL="${RPC_URL:-http://127.0.0.1:5050/rpc/v0_10_2}"

command -v bun >/dev/null || { echo "bun not found on PATH" >&2; exit 1; }
if [[ "${1:-}" == "--migrate-only" ]]; then
  shift
elif [[ "${1:-}" != "--inspect" ]]; then
  (cd "$GAME_DIR" && scarb --profile madara build)
fi

exec bun "$REPO_ROOT/config/deployer/clean/cli/deploy-world.ts" "$@"
