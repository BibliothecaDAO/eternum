#!/usr/bin/env bash
# Deploys two blitz worlds to the local spike appchain, then renders the
# multi-world torii config.
#
# Trick: a dojo world's address derives from its seed, so we use ONE profile
# (dojo_spike.toml, cloned from dojo_local.toml) and swap the seed between the
# two `sozo migrate` runs — one slow `sozo build`, two worlds. This mirrors
# what the world factory does on-chain in production: same code, new world per
# game.
#
# Usage: scripts/deploy-worlds.sh
# Prereq: katana running (docker-compose up -d), sozo 1.8.x on PATH.
set -euo pipefail

SPIKE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$SPIKE_DIR/../../.." && pwd)"
GAME_DIR="$REPO_ROOT/contracts/l3/game"
RPC_URL="${RPC_URL:-http://localhost:5050}"
PROFILE="spike"

command -v sozo >/dev/null || { echo "sozo not found on PATH" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq not found on PATH" >&2; exit 1; }

# katana rc.9 serves Starknet RPC 0.10.0; the repo-pinned sozo 1.8.0 only
# speaks 0.9 (and exits 0 on the version error — don't trust its exit code).
# 1.8.7 speaks 0.10; override here instead of touching contracts/l3/game/.tool-versions.
export ASDF_SOZO_VERSION="${ASDF_SOZO_VERSION:-1.8.7}"
echo "==> using sozo $(sozo --version | head -1 | awk '{print $2}')"

echo "==> waiting for katana at $RPC_URL"
for i in $(seq 1 30); do
  if curl -sf -m 2 -X POST -H 'content-type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' \
      "$RPC_URL" >/dev/null; then
    break
  fi
  [ "$i" = 30 ] && { echo "katana unreachable" >&2; exit 1; }
  sleep 2
done

# dojo_local.toml needs two patches for sozo 1.8.7:
# - [env] has no rpc_url; 1.8.7's blake2s autodetect unwrap-panics on that
#   (artifact_to_local.rs — 1.8.0 silently defaulted to localhost:5050).
# - [lib_versions] is stale: missing raid_library and behind on every version;
#   values below come from dojo_appchain_blitz.toml, the maintained profile.
render_profile() {
  local seed="$1"
  cp "$GAME_DIR/dojo_local.toml" "$GAME_DIR/dojo_$PROFILE.toml"
  sed -i \
    -e "s|^seed = .*|seed = \"$seed\"|" \
    -e "/^\[env\]/a rpc_url = \"$RPC_URL\"" \
    -e 's|"s1_eternum-combat_library" = ".*"|"s1_eternum-combat_library" = "0_1_14"|' \
    -e 's|"s1_eternum-rng_library" = ".*"|"s1_eternum-rng_library" = "0_1_16"|' \
    -e 's|"s1_eternum-biome_library" = ".*"|"s1_eternum-biome_library" = "0_1_13"|' \
    -e 's|"s1_eternum-structure_creation_library" = ".*"|"s1_eternum-structure_creation_library" = "0_1_18"|' \
    -e '/"s1_eternum-combat_library"/a "s1_eternum-raid_library" = "0_1_0"' \
    "$GAME_DIR/dojo_$PROFILE.toml"
}

deploy_world() {
  local seed="$1"
  render_profile "$seed"
  # migrate chatter goes to stderr so callers can capture just the address
  (cd "$GAME_DIR" && sozo migrate --profile "$PROFILE") >&2
  [ -f "$GAME_DIR/manifest_$PROFILE.json" ] || {
    echo "manifest_$PROFILE.json missing — migrate did not complete" >&2; exit 1; }
  jq -r '.world.address' "$GAME_DIR/manifest_$PROFILE.json"
}

echo "==> sozo build (one-time, slow on first run)"
render_profile "s1_eternum_spike_1"
(cd "$GAME_DIR" && sozo build --profile "$PROFILE")

echo "==> migrating world 1"
WORLD_1="$(deploy_world "s1_eternum_spike_1" | tail -1)"
echo "    world 1: $WORLD_1"

echo "==> migrating world 2"
WORLD_2="$(deploy_world "s1_eternum_spike_2" | tail -1)"
echo "    world 2: $WORLD_2"

echo "==> rendering torii config"
sed -e "s|{WORLD_1}|$WORLD_1|" -e "s|{WORLD_2}|$WORLD_2|" \
  "$SPIKE_DIR/torii/torii.template.toml" > "$SPIKE_DIR/torii/torii.toml"

cat > "$SPIKE_DIR/worlds.env" <<EOF
WORLD_1=$WORLD_1
WORLD_2=$WORLD_2
EOF

echo "==> done. start torii with:"
echo "    docker-compose --profile torii up -d"
