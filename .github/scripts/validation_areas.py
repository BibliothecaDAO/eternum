"""The validation areas: each is a set of path patterns, and a change to any path it matches runs that area's checks.
The scope step in validation.yml selects areas from a diff with them; check_validation_areas.py proves every area
covers the files its own files read, and that every CI file has an owner.

A CI file belongs to the area that runs it: a workflow validation.yml calls belongs to the area whose job calls it, and
a composite action to the areas whose workflows use it. CI files that only the static job checks, or that validation
never runs, belong to STATIC. A file under .github that none of these name fails the static job, naming the file."""
import fnmatch

# A change to any of these runs every area: every area's checks install from them.
SHARED = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]
# CI files the static job owns. Static runs on every run, so a change to one selects no further area: static tests the
# scripts and this map, and the deploy and publish workflows run only when dispatched, pushed to next or tagged.
STATIC = [
    ".github/workflows/validation.yml",
    ".github/workflows/static.yml",
    ".github/scripts/**",
    ".github/ISSUE_TEMPLATE/**",
]
AREAS = {
    "client": [
        ".prettierrc",
        "contracts/l3/world-native/scripts/generate-site-previews.mjs",
        "contracts/l3/world-native/scripts/site-previews.test.mjs",
        "contracts/l3/world-native/src/expeditions.cairo",
        "contracts/l3/world-native/src/progression.cairo",
        "contracts/l3/world-native/src/taxonomy.cairo",
        "contracts/l3/world-native/src/resources.cairo",
        "contracts/l3/world-native/src/rules.cairo",
        "contracts/l3/player-account/class-hash.json",
        ".github/workflows/test-client.yml",
        "apps/game/**",
        # The other surfaces the brand check (apps/game/src/brand/brand.test.ts) reads, and what the docs config reads.
        "apps/game-docs/docs/styles.css",
        "apps/game-docs/docs/pages/index.mdx",
        "apps/game-docs/docs/brand.gen.json",
        "apps/game-docs/vocs.config.ts",
        "apps/game-docs/docs/utils/paths.ts",
        "apps/game-docs/vite-plugin-llm-txt.mjs",
        "apps/status/public/index.html",
        # The client job's own checkers, which its workflow runs through root package.json scripts.
        "scripts/hud-sheet/**",
        "scripts/icons/**",
        "scripts/shell-tokens/**",
        "scripts/words/**",
        "scripts/check-forbidden-hosts*",
        "apps/herald/src/**",
        "apps/launch-service/src/**",
        "apps/launch-service/migrations/**",
        "apps/launch-service/wrangler.jsonc",
        "packages/**",
        "config/**",
        "deploy/first/environments.json",
        "contracts/l2/ledger/scripts/chest-preset.js",
        "contracts/l2/ledger/schema/**",
        "contracts/l2/ledger/src/contract.cairo",
        "contracts/l3/world-native/schema/**",
        "contracts/l3/world-native/tests/fixtures/**",
        "contracts/l3/world-native/src/tests/fixtures/spatial-replay/**",
        "contracts/common/addresses/**",
        "contracts/utils/**"
    ],
    "herald": [
        ".github/workflows/test-herald.yml",
        # deployment.bun.test.ts imports these through a spawned Python interpreter.
        "deploy/athanor/scripts/directory.py",
        "deploy/athanor/scripts/service_requests.py",
        "apps/herald/**",
        "apps/launch-service/src/release.ts",
        "packages/**",
        "config/**",
        "deploy/first/environments.json",
        "contracts/l2/ledger/scripts/chest-preset.js",
        "contracts/l2/ledger/schema/**",
        "contracts/l2/ledger/src/contract.cairo",
        "contracts/l3/world-native/schema/**",
        "contracts/l3/world-native/tests/fixtures/**",
        "contracts/l3/world-native/src/tests/fixtures/spatial-replay/**",
        "contracts/common/addresses/**",
        "contracts/utils/**"
    ],
    "services": [
        "contracts/l3/player-account/class-hash.json",
        ".github/workflows/test-services.yml",
        "apps/launch-service/**",
        "apps/admin/**",
        "apps/realms/**",
        "apps/value-relay/**",
        "apps/status-monitor/**",
        "apps/indexer/**",
        "apps/status/**",
        "apps/guardian/**",
        "apps/web/**",
        "apps/herald/src/native/schema.ts",
        "apps/herald/src/shard-manifest.ts",
        "packages/**",
        "config/**",
        "deploy/first/environments.json",
        "contracts/l2/ledger/scripts/chest-preset.js",
        "contracts/l2/ledger/schema/**",
        "contracts/l2/ledger/src/contract.cairo",
        "contracts/l3/world-native/schema/**",
        "contracts/l3/world-native/tests/fixtures/**",
        "contracts/common/addresses/**",
        "contracts/utils/**"
    ],
    "portal": [
        ".github/workflows/test-portal.yml",
        "apps/web/**",
        "packages/db/**",
        "packages/chain/**",
        "packages/identity/**",
        "contracts/common/addresses/**"
    ],
    "native": [
        ".tool-versions",
        "contracts/l2/ledger/**",
        "contracts/l2/collectibles/**",
        ".github/workflows/test-native.yml",
        "apps/herald/src/**",
        "apps/launch-service/src/**",
        "apps/launch-service/migrations/**",
        "apps/launch-service/wrangler.jsonc",
        "contracts/l3/**",
        "contracts/common/addresses/**",
        "contracts/utils/**",
        "packages/**",
        "config/**",
        "deploy/first/environments.json",
        "contracts/l2/ledger/scripts/chest-preset.js",
        "contracts/l2/ledger/schema/**",
        "contracts/l2/ledger/src/contract.cairo",
        "deploy/athanor/**",
        "deploy/first/**",
        "apps/game/package.json",
        "apps/game/src/runtime/l2-environment.ts",
        "apps/game/src/shell/frame/environment.ts",
        "contracts/l2/ledger/scripts/commands/deployment/**",
        "contracts/scripts-runtime/**",
        "apps/value-relay/src/**",
        # The relay's Realm-entry test runs the identity Worker's holdings reader, as the IDENTITY binding serves it.
        "apps/realms/server/realm-holdings.ts",
        "apps/realms/server/l2.ts",
        "deploy/release/**",
        "deploy/shard/**",
        "scripts/generate-realm-metadata.py"
    ],
    "runtime": [
        ".github/workflows/test-agent-runtime.yml",
        "apps/agent-runner/**",
        "apps/launch-service/**",
        "apps/herald/src/native/schema.ts",
        "apps/herald/src/shard-manifest.ts",
        "contracts/l3/world-native/schema/**",
        "contracts/l3/world-native/tests/fixtures/**",
        "contracts/common/addresses/**",
        "contracts/utils/**",
        "deploy/athanor/**",
        "deploy/first/**",
        "apps/game/package.json",
        "apps/game/src/runtime/l2-environment.ts",
        "apps/game/src/shell/frame/environment.ts",
        "contracts/l2/ledger/scripts/commands/deployment/**",
        "contracts/scripts-runtime/**",
        "apps/value-relay/src/**",
        # The relay's Realm-entry test runs the identity Worker's holdings reader, as the IDENTITY binding serves it.
        "apps/realms/server/realm-holdings.ts",
        "apps/realms/server/l2.ts",
        # The release files this area reads: the release id (deploy/first) and the shard settings (deploy/athanor).
        "deploy/release/native-release.ts",
        "deploy/release/*.json",
        "deploy/shard/**",
        "packages/**",
        "config/**",
        "deploy/first/environments.json",
        "contracts/l2/ledger/schema/**",
        "contracts/l2/ledger/scripts/chest-preset.js"
    ],
    "terrain": [
        ".github/workflows/verify-terrain.yml",
        "apps/game/src/three/**",
        "apps/game/scripts/**",
        "apps/game/public/**",
        "apps/game/vitest.assets.*",
        "apps/game/asset-sources/realms/devcon/**",
        "packages/core/src/utils/biome/**"
    ],
    "amm": [
        ".github/workflows/test-ammv2.yml",
        ".github/actions/fetch-cairo-dependencies/**",
        "contracts/l2/ammv2/**"
    ],
    "collectibles": [
        ".tool-versions",
        ".github/workflows/test-collectibles.yml",
        ".github/actions/fetch-cairo-dependencies/**",
        "contracts/l2/collectibles/**"
    ],
    "mmr": [
        ".tool-versions",
        ".github/workflows/test-mmr.yml",
        ".github/actions/fetch-cairo-dependencies/**",
        "contracts/l2/mmr/**"
    ],
    "season_pass": [
        ".github/workflows/test-season-pass.yml",
        ".github/actions/fetch-cairo-dependencies/**",
        "contracts/l2/season_pass/**"
    ],
    "docs": [
        ".github/workflows/test-docs.yml",
        "apps/game-docs/**",
        "apps/launch-service/src/release.ts",
        "packages/**",
        "config/**",
        "deploy/first/environments.json",
        "contracts/l2/ledger/scripts/chest-preset.js",
        "contracts/l2/ledger/schema/**",
        "contracts/l3/world-native/schema/**",
        "contracts/l3/world-native/tests/fixtures/**",
        "contracts/common/addresses/**",
        "contracts/utils/**",
        "apps/herald/src/native/schema.ts",
        "apps/herald/src/shard-manifest.ts",
        # The game files the docs draw on: its icon set and meanings, and the patch notes the changelog page shows.
        "apps/game/public/**",
        "apps/game/asset-sources/facets/**",
        "apps/game/src/ui/design-system/icon-meaning.ts",
        "apps/game/src/shell/generated/patch-notes.ts",
        "apps/game/src/shell/news/patch-note.ts"
    ],
    "contract_scripts": [
        ".github/workflows/test-contract-scripts.yml",
        "contracts/scripts-runtime/**",
        "packages/chain/chain-guard.js",
        "packages/chain/shard-manifest.js"
    ]
}

# Areas the import check skips, and why.
UNCHECKED = {
    "terrain": "renderer captures triggered by the renderer and asset sources alone; the client area covers their imports",
    "amm": "Cairo only",
    "collectibles": "Cairo only",
    "mmr": "Cairo only",
    "season_pass": "Cairo only",
}


def matches(path, patterns):
    return any(fnmatch.fnmatch(path, pattern) for pattern in patterns)


# These checks run when their own inputs change; core checks run on every landing push.
PATH_SCOPED = {"amm", "season_pass", "terrain", "portal"}


def selected_areas(files, every_area, landing=False):
    """Select changed inputs; landing pushes additionally require all core areas."""
    return {
        area: (every_area or (landing and area not in PATH_SCOPED)
               or any(matches(path, SHARED + patterns) for path in files))
        for area, patterns in AREAS.items()
    }


def unowned_ci_files(files):
    """The files under .github that no area, STATIC or SHARED names: a change to one would run no check."""
    owners = SHARED + STATIC + [pattern for patterns in AREAS.values() for pattern in patterns]
    return [path for path in files if path.startswith(".github/") and not matches(path, owners)]
