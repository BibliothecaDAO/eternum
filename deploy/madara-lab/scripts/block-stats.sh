#!/usr/bin/env bash
# Summarizes Madara's per-block `close_block_complete` JSON log lines for the lab container.
#
#   deploy/madara-lab/scripts/block-stats.sh            # everything since container start
#   deploy/madara-lab/scripts/block-stats.sh 10m        # last 10 minutes (docker --since syntax)
#
# This is the measurement source for the lab: Madara logs one structured line per closed block with
# txs_executed, l2_gas_consumed, block_production_ms, merklization_ms and db_write_ms. Nothing here is
# inferred from wall clocks on the client side.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="${MADARA_CONTAINER:-madara-lab}"
SINCE="${1:-}"

if [[ -n "$SINCE" ]]; then
  docker logs "$CONTAINER" --since "$SINCE" 2>&1
else
  docker logs "$CONTAINER" 2>&1
fi | grep close_block_complete | python3 "$SCRIPT_DIR/block-stats.py"
