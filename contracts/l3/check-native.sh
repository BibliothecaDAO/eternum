#!/usr/bin/env bash
# The world contracts' landing gate. GitHub compiles no world contracts, so a pull request that changes them runs this
# once, when it is ready to land and not while it is being written: the build, class sizes, the player entrypoint ABI, the fact wire declarations, schema and format drift, then the whole test suite. It needs the tools of
# deploy/athanor/README.md on PATH, with the runner installed as described in world-native/TOOLCHAIN.md.
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
world=contracts/l3/world-native
verifier=contracts/l3/vrf-verifier
account=contracts/l3/player-account
node "$world/scripts/generate-extension.mjs" --check
runner=$(python3 "$world/toolchain/snforge.py" resolve)
python3 -m unittest discover -s "$world/toolchain" -p "test_snforge.py"

# Override LEDGER_SCARB / LEDGER_SNFORGE when PATH is pinned to the world toolchain.
bash contracts/l2/ledger/check.sh

# The account and ledger both pin Scarb 2.13.1; reject a stale service class before the world build or release tag.
(cd "$account" && "${LEDGER_SCARB:-scarb}" build)
bun test "$account/check-class-hash.test.ts"
bun "$account/check-class-hash.ts"

# Pin the owned verification algorithm before compiling the world that dispatches to it.
(cd "$verifier" && scarb build)
bun "$verifier/scripts/pin-class.ts" --check
(cd "$verifier" && "$runner" test)

(cd "$world" && scarb build)
node --test "$world/scripts/check-class-sizes.test.mjs" "$world/scripts/check-fact-wire.test.mjs" "$world/scripts/event-layouts.test.mjs" "$world/scripts/taxonomy.test.mjs" "$world/scripts/rule-constants.test.mjs"
node "$world/scripts/check-class-sizes.mjs"

(cd "$world/tests" && RAYON_NUM_THREADS=1 scarb build --test --package 'world_tests_*')
node "$world/scripts/check-fact-wire.mjs"

# A regenerated schema or a reformatted source that differs from what is committed fails here, with the diff shown.
pnpm run schema:native
(cd "$world" && scarb fmt)
(cd "$world/tests" && scarb fmt)
git diff --exit-code -- "$world/schema" "$world/src" "$world/storage" "$world/tests"

(cd "$world" && scarb test)
