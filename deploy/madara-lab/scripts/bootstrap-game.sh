#!/usr/bin/env bash
# Declares the gameplay account, deploys PlayerRegistry, and initializes the
# persistent s2 registrar with the fee-free 96-player Madara preset.
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$LAB_DIR/../.." && pwd)"

# v0_10_2, not v0_9_0: starkli (deploy-gameplay-contracts.ts) shares sozo's v0.9 pre-confirmed-block parse bug on
# the nightly pin (see deploy-world.sh); the v0.10.2 route serializes those blocks correctly.
export RPC_URL="${RPC_URL:-http://127.0.0.1:5050/rpc/v0_10_2}"
export DOJO_ACCOUNT_ADDRESS="${DOJO_ACCOUNT_ADDRESS:-0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d}"
export DOJO_PRIVATE_KEY="${DOJO_PRIVATE_KEY:-0x077e56c6dc32d40a67f6f7e6625c8dc5e570abe49c0a24e9202e4ae906abcc07}"
export BINDING_AUTHORITY_ADDRESS="${BINDING_AUTHORITY_ADDRESS:-0x008a1719e7ca19f3d91e8ef50a48fc456575f645497a1d55f30e3781f786afe4}"

echo "==> declare gameplay account and deploy PlayerRegistry"
bun "$LAB_DIR/scripts/deploy-gameplay-contracts.ts"

# deploy-s2-world's ChainConfig needs the L3 operator (the register_from_l2 gate) and the PlayerRegistry just
# deployed. The lab runs dev-mode games with no L2 relay, so the operator is inert here — default it to the
# deployer account so the write-once ChainConfig holds a non-zero address until a real operator arrives with L2.
export S2_OPERATOR_ADDRESS="${S2_OPERATOR_ADDRESS:-$DOJO_ACCOUNT_ADDRESS}"
export PLAYER_REGISTRY_ADDRESS="${PLAYER_REGISTRY_ADDRESS:-$(jq -r '.playerRegistryAddress' "$LAB_DIR/.lab/gameplay-contracts.json")}"

echo "==> bootstrap s2 ChainConfig and register Madara preset 1"
bun "$REPO_ROOT/deploy/appchain/scripts/deploy-s2-world.ts" --environment madara.blitz
