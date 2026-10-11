"""The validation areas: each is a set of path patterns, and a change to any path it matches runs that area's checks.
The scope step in validation.yml selects areas from a diff with them; check_validation_areas.py proves every area
covers the files its own files read, and that every CI file has an owner.

A CI file belongs to the area that runs it: a workflow validation.yml calls belongs to the area whose job calls it, and
a composite action to the areas whose workflows use it. CI files that only the static job checks, or that validation
never runs, belong to STATIC. A file under .github that none of these name fails the static job, naming the file."""
import fnmatch

# A change to any of these runs every area: every area's checks install from them.
SHARED = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]
# CI files the static job owns. Static runs on every run, so a change to one selects no further area: static tests the
# scripts and this map, and the deploy and publish workflows run only when dispatched, pushed to next or tagged.
STATIC = [
    ".github/workflows/validation.yml",
    ".github/workflows/static.yml",
    ".github/workflows/landing-validated.yml",
    ".github/workflows/shard-images.yml",
    ".github/scripts/**",
    ".github/ISSUE_TEMPLATE/**",
]
AREAS = {
    "client": [
        ".github/workflows/test-client.yml",
        "apps/game/**",
        "apps/herald/src/**",
        "apps/launch-service/src/**",
        "apps/launch-service/migrations/0007_game_entry.sql",
        "apps/launch-service/migrations/0008_unproven_blitz_entries.sql",
        "apps/launch-service/wrangler.jsonc",
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
    "herald": [
        ".github/workflows/test-herald.yml",
        "apps/herald/**",
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
    "services": [
        ".github/workflows/test-services.yml",
        "apps/launch-service/**",
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
        ".github/workflows/test-native.yml",
        "apps/herald/src/**",
        "apps/launch-service/src/**",
        "apps/launch-service/migrations/0007_game_entry.sql",
        "apps/launch-service/migrations/0008_unproven_blitz_entries.sql",
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
