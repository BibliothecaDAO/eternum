#!/usr/bin/env bash
# The world contracts' landing gate. GitHub compiles no world contracts, so a pull request that changes them runs this
# once, when it is ready to land and not while it is being written: the build, class sizes, the player entrypoint ABI, the fact wire declarations, schema and format drift, then the whole test suite. It needs the tools of
# deploy/athanor/README.md on PATH, with the corrected snforge of world-native/TOOLCHAIN.md first.
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
world=contracts/l3/world-native
verifier=contracts/l3/vrf-verifier

# Pin the owned verification algorithm before compiling the world that dispatches to it.
(cd "$verifier" && scarb build)
bun "$verifier/scripts/pin-class.ts" --check
(cd "$verifier" && snforge test)

(cd "$world" && scarb build)
node --test "$world/scripts/check-class-sizes.test.mjs" "$world/scripts/event-layouts.test.mjs" "$world/scripts/taxonomy.test.mjs"
node "$world/scripts/check-class-sizes.mjs"

(cd "$world" && scarb build --test)
node "$world/scripts/check-fact-wire.mjs"

# A regenerated schema or a reformatted source that differs from what is committed fails here, with the diff shown.
pnpm run schema:native
(cd "$world" && scarb fmt)
git diff --exit-code -- "$world/schema" "$world/src" "$world/storage"

(cd "$world" && scarb test)
