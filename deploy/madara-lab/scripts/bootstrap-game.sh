#!/usr/bin/env bash
# Bootstrap the local gameplay identity and native persistent world.
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$LAB_DIR/../.." && pwd)"
cd "$REPO_ROOT"
: "${NATIVE_WORLD_MANIFEST:?NATIVE_WORLD_MANIFEST is required}"
: "${NATIVE_ACCOUNT_ADDRESS:?NATIVE_ACCOUNT_ADDRESS is required}"
: "${NATIVE_PRIVATE_KEY:?NATIVE_PRIVATE_KEY is required}"
: "${RPC_URL:?RPC_URL is required}"
: "${SEQUENCING_SUBMITTER_ADDRESS:?SEQUENCING_SUBMITTER_ADDRESS is required}"
: "${NATIVE_WORLD_SEED:?NATIVE_WORLD_SEED is required}"
bun "$LAB_DIR/scripts/deploy-gameplay-contracts.ts"
bun config/deployer/clean/cli/deploy-world.ts --identity "$LAB_DIR/.lab/gameplay-contracts.json" \
  --submitter "$SEQUENCING_SUBMITTER_ADDRESS" --seed "$NATIVE_WORLD_SEED"
bun config/deployer/clean/registrar/register-preset.ts --environment madara.blitz --preset-id 2 --balance-profile official-60
