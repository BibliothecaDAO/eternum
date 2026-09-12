#!/usr/bin/env bash
# Play one Blitz game end to end as a guest agent: the M2 gate, "one full Blitz under a measured cost envelope".
#
# Runs the runner in guest mode against a named Blitz game, or the newest one still open (Registration or Live and
# not past its end), with a chosen model profile, until the game ends. Then prints the manifest path and its cost
# line. No cost figure is asserted here: the number is whatever the manifest of a real run records.
#
# Environment: OPENROUTER_API_KEY, BINDING_AUTHORITY_PRIVATE_KEY, and the VITE_PUBLIC_* values from apps/game/.env.
#
# Usage, from anywhere:
#   set -a; source apps/game/.env; set +a
#   OPENROUTER_API_KEY=... BINDING_AUTHORITY_PRIVATE_KEY=... \
#     apps/agent-runner/scripts/play-blitz.sh [--game-name <name>] [--model-profile cheap|balanced|strong] [--data-dir <dir>]
set -euo pipefail

RUNNER_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
GAME_NAME=""
MODEL_PROFILE=balanced
DATA_DIR=""

main() {
  parse_args "$@"
  require_env OPENROUTER_API_KEY BINDING_AUTHORITY_PRIVATE_KEY VITE_PUBLIC_HERALD_URL VITE_PUBLIC_NODE_URL \
    VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS
  local game_id data_dir log
  game_id=$(resolve_game_id)
  data_dir=${DATA_DIR:-$RUNNER_DIR/.agent-data/$game_id}
  log="$data_dir/play-blitz.log"
  mkdir -p "$data_dir"
  printf '[play-blitz] game %s, model profile %s, data dir %s\n' "$game_id" "$MODEL_PROFILE" "$data_dir"
  play_game "$game_id" "$data_dir" | tee "$log"
  report "$data_dir" "$log"
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --game-name) GAME_NAME=$2; shift 2 ;;
      --model-profile) MODEL_PROFILE=$2; shift 2 ;;
      --data-dir) DATA_DIR=$2; shift 2 ;;
      *) echo "play-blitz.sh: unknown argument $1" >&2; exit 2 ;;
    esac
  done
}

require_env() {
  for name in "$@"; do
    if [ -z "${!name:-}" ]; then
      echo "play-blitz.sh: $name is required in the environment" >&2
      exit 2
    fi
  done
}

# The newest open Blitz game on Herald, or the named one if it is open. Ended games are excluded by their clock, the
# way the runner's phase check excludes them, so the run does not stop at its first tick.
resolve_game_id() {
  curl -fsS --max-time 15 "${VITE_PUBLIC_HERALD_URL%/}/madara/games" | python3 - "$GAME_NAME" <<'PY'
import json, sys, time

name = sys.argv[1]
now = int(time.time())
games = json.load(sys.stdin)["games"]
open_blitz = [
    game
    for game in games
    if game["mode"] == "blitz"
    and game["status"] in ("Registration", "Live")
    and (game["clock"]["end_at"] == 0 or game["clock"]["end_at"] > now)
]
chosen = [game for game in open_blitz if game["name"] == name] if name else sorted(open_blitz, key=lambda game: -game["game_id"])
if not chosen:
    listed = ", ".join(f'{game["game_id"]}:{game["name"]}:{game["status"]}' for game in games) or "none"
    sys.exit(f"play-blitz.sh: no open Blitz game{' named ' + name if name else ''} on Herald; listed: {listed}")
print(chosen[0]["game_id"])
PY
}

# The same command the image's ENTRYPOINT runs; the runner exits 0 when the game ends and 1 when its sync fails.
play_game() {
  (cd "$RUNNER_DIR" && bun src/main.ts --game-id "$1" --signer guest --model-profile "$MODEL_PROFILE" --data-dir "$2")
}

report() {
  python3 - "$1" "$2" <<'PY'
import json, sys

data_dir, log = sys.argv[1], sys.argv[2]
manifests = [json.loads(line) for line in open(log) if line.startswith('{"event":"agent_runner_manifest"')]
if not manifests:
    sys.exit(f"play-blitz.sh: the runner printed no manifest line; see {log}")
manifest = manifests[-1]
llm, actions, tokens = manifest["llm"], manifest["actions"], manifest["llm"]["tokens"]
print(f'[play-blitz] manifest: {data_dir}/runs/{manifest["runId"]}.json')
print(f'[play-blitz] stopped: {manifest["stopReason"]} after {manifest["runtime"]["wallTimeMs"] // 1000}s and {manifest["loop"]["ticks"]} ticks')
print(
    f'[play-blitz] cost: {llm["costUsd"]:.4f} USD over {llm["calls"]} model calls '
    f'({tokens["input"]} in / {tokens["output"]} out tokens); '
    f'actions confirmed {actions["confirmed"]}, refused {actions["refused"]}, failed {actions["failed"]}'
)
PY
}

main "$@"
