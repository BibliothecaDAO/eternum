#!/usr/bin/env bash
# Promote the hot replica to sequencer (phase-2 E.2), fenced by the identity token.
#
#   1. record the replica's head (RPO reference) and stop the old sequencer, whether it is alive or already dead
#   2. verify its RPC port is closed and REMOVE the container, so `restart: unless-stopped` cannot revive it
#   3. move the identity token: delete /data/SEQUENCER from the old volume, create it in the replica's volume
#   4. stop the replica and start `madara-promoted` on the replica's volume (alias `madara`, same published ports)
#   5. print RTO and the heads; `docker compose up madara` now fails at its entrypoint (no identity)
#
# Usage: scripts/promote-replica.sh    (from deploy/madara-lab, docker compose in scope)
set -euo pipefail
cd "$(dirname "$0")/.."

rpc_head() { curl -sf -m 2 -X POST -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"starknet_blockNumber","params":[]}' "$1" | sed -E 's/.*"result":([0-9]+).*/\1/' || echo "unreachable"; }

started_at=$(date +%s%3N)
sequencer_head=$(rpc_head http://127.0.0.1:5050)
replica_head=$(rpc_head http://127.0.0.1:5055)
echo "promote: sequencer head=${sequencer_head} replica head=${replica_head}"

docker compose stop -t 5 madara >/dev/null 2>&1 || true
docker compose rm -f madara >/dev/null 2>&1 || true
if curl -sf -m 1 http://127.0.0.1:5050 >/dev/null 2>&1; then echo "promote: port 5050 still answers — refusing to continue"; exit 2; fi
echo "promote: old sequencer stopped and removed, port 5050 closed"

docker run --rm -v madara-lab_madara-data:/old -v madara-lab_madara-replica-data:/new alpine \
  sh -c 'rm -f /old/SEQUENCER && touch /old/RETIRED && touch /new/SEQUENCER' >/dev/null
echo "promote: identity token moved to the replica volume"

docker compose --profile replica stop -t 5 madara-replica >/dev/null 2>&1 || true
docker compose --profile promoted up -d --wait madara-promoted >/dev/null 2>&1
promoted_head=$(rpc_head http://127.0.0.1:5050)
ended_at=$(date +%s%3N)
echo "promote: promoted sequencer serving at head=${promoted_head}; RTO=$(( ended_at - started_at )) ms"
echo "promote: RPO = blocks/pre-confirmed content the replica had not received: last sequencer head ${sequencer_head} vs replica ${replica_head}"
