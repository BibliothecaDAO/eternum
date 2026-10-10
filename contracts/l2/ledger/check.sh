#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
# The ledger uses Scarb 2.13.1 / Foundry 0.51.2, independently of the native world toolchain.
ledger_scarb=$(command -v "${LEDGER_SCARB:-scarb}")
# Foundry launches Scarb too; use the same compiler for the build and tests.
export PATH="$(dirname -- "$ledger_scarb"):$PATH"
"$ledger_scarb" build
# Regenerate after an intentional ABI change with: node generate-abi.mjs
node generate-abi.mjs --check
"${LEDGER_SNFORGE:-snforge}" test
