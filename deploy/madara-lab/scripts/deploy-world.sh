#!/usr/bin/env bash
# Builds the game contracts and migrates the s2 world onto the local Madara lab chain.
#
#   deploy/madara-lab/scripts/deploy-world.sh            # build + migrate
#   deploy/madara-lab/scripts/deploy-world.sh --migrate-only
#
# Prereqs: `docker compose up -d` in deploy/madara-lab (madara healthy on :5060), sozo 1.8.7 via asdf.
#
# Two Madara-specific facts this script encodes (see README "Why these flags"):
#   - Madara's chain protocol is 0.14.2, which hashes compiled (CASM) classes with blake2s. sozo 1.8.7 only
#     auto-selects blake2s when the RPC URL contains "sepolia"/"testnet"; anywhere else it silently uses
#     poseidon and the world declare fails with CompiledClassHashMismatch. The flag is mandatory here.
#   - sozo 1.8.7 is built against Starknet RPC 0.9.0. Madara serves 0.10.2 at `/` and every version at
#     `/rpc/v0_9_0` etc. Both routes work for migrate; dojo_madara.toml pins the versioned one so the
#     "RPC version mismatch" warning never masks a real failure.
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$LAB_DIR/../.." && pwd)"
GAME_DIR="$REPO_ROOT/contracts/game"
RPC_URL="${RPC_URL:-http://127.0.0.1:5060/rpc/v0_9_0}"
PROFILE="madara"
OUT_DIR="$LAB_DIR/.lab"

export ASDF_SOZO_VERSION="${ASDF_SOZO_VERSION:-1.8.7}"
command -v sozo >/dev/null || { echo "sozo not found on PATH" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq not found on PATH" >&2; exit 1; }

wait_for_chain() {
  echo "==> waiting for madara at $RPC_URL"
  for i in $(seq 1 30); do
    if curl -sf -m 2 -X POST -H 'content-type: application/json' \
        -d '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' "$RPC_URL" >/dev/null; then
      return
    fi
    [ "$i" = 30 ] && { echo "madara unreachable at $RPC_URL" >&2; exit 1; }
    sleep 2
  done
}

build_contracts() {
  echo "==> sozo build (profile $PROFILE)"
  (cd "$GAME_DIR" && sozo -P "$PROFILE" build)
}

migrate_world() {
  echo "==> sozo migrate (profile $PROFILE, blake2s casm hash)"
  (cd "$GAME_DIR" && sozo -P "$PROFILE" migrate --rpc-url "$RPC_URL" --use-blake2s-casm-class-hash)
}

record_world_address() {
  local manifest="$GAME_DIR/manifest_$PROFILE.json"
  local world
  world="$(jq -r '.world.address' "$manifest")"
  mkdir -p "$OUT_DIR"
  printf '%s\n' "$world" > "$OUT_DIR/world-address"
  sed -e "s|{WORLD_ADDRESS}|$world|" "$LAB_DIR/torii.toml.template" > "$OUT_DIR/torii.toml"
  echo "==> world $world (recorded in $OUT_DIR/world-address, torii config rendered)"
}

wait_for_chain
if [[ "${1:-}" != "--migrate-only" ]]; then
  build_contracts
fi
migrate_world
record_world_address
