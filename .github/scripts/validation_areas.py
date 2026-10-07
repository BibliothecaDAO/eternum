"""The validation areas: each is a set of path patterns, and a change to any path it matches runs that area's checks.
The scope step in validation.yml selects areas from a diff with them; check_validation_areas.py proves every area
covers the files its own files read."""
import fnmatch

# A change to any of these runs every area.
SHARED = [".github/workflows/**", ".github/scripts/**", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]
AREAS = {
    "client": [
        "apps/game/**",
        "apps/herald/src/**",
        "apps/launch-service/src/**",
        "apps/launch-service/wrangler.jsonc",
        "packages/**",
        "config/**",
        "contracts/l3/world-native/schema/**",
        "contracts/l3/world-native/tests/fixtures/**",
        "contracts/l3/randomness-protocol/tests/fixtures/**",
        "contracts/common/addresses/**",
        "contracts/utils/**"
    ],
    "herald": [
        "apps/herald/**",
        "packages/**",
        "config/**",
        "contracts/l3/world-native/schema/**",
        "contracts/l3/world-native/tests/fixtures/**",
        "contracts/l3/randomness-protocol/tests/fixtures/**",
        "contracts/common/addresses/**",
        "contracts/utils/**"
    ],
    "services": [
        "apps/launch-service/**",
        "apps/realms/**",
        "apps/guardian/**",
        "apps/web/**",
        "apps/herald/src/native/schema.ts",
        "apps/herald/src/shard-manifest.ts",
        "packages/**",
        "config/**",
        "contracts/l3/world-native/schema/**",
        "contracts/l3/world-native/tests/fixtures/**",
        "contracts/l3/randomness-protocol/tests/fixtures/**",
        "contracts/common/addresses/**",
        "contracts/utils/**"
    ],
    "native": [
        "apps/gateway/**",
        "apps/herald/src/**",
        "apps/launch-service/src/**",
        "apps/launch-service/wrangler.jsonc",
        "contracts/l3/**",
        "contracts/common/addresses/**",
        "contracts/utils/**",
        "packages/**",
        "config/**",
        "deploy/athanor/**",
        "deploy/release/**",
        "deploy/shard/**",
        "scripts/generate-realm-metadata.py"
    ],
    # The native-world contract suite inside the native area: its build, tests and schema generation read
    # the L3 contracts and Herald's row serialization, never the app, core packages, config or deploy tooling.
    "native_world": [
        "contracts/l3/**",
        "apps/herald/src/model-registry.ts",
        "apps/herald/src/native/serde.ts",
        "apps/herald/src/native/schema.ts",
        "apps/herald/src/types.ts"
    ],
    "runtime": [
        "apps/agent-runner/**",
        "apps/launch-service/**",
        "apps/herald/src/native/schema.ts",
        "apps/herald/src/shard-manifest.ts",
        "contracts/l3/world-native/schema/**",
        "contracts/l3/world-native/tests/fixtures/**",
        "contracts/l3/randomness-protocol/tests/fixtures/**",
        "contracts/common/addresses/**",
        "contracts/utils/**",
        "deploy/athanor/**",
        "deploy/shard/**",
        "packages/**",
        "config/**"
    ],
    "terrain": [
        "apps/game/src/three/**",
        "apps/game/scripts/**",
        "apps/game/public/**",
        "apps/game/vitest.assets.*",
        "packages/core/src/utils/biome/**"
    ],
    "amm": [
        "contracts/l2/ammv2/**"
    ],
    "collectibles": [
        "contracts/l2/collectibles/**"
    ],
    "mmr": [
        "contracts/l2/mmr/**"
    ],
    "season_pass": [
        "contracts/l2/season_pass/**"
    ],
    "contract_scripts": [
        "contracts/scripts-runtime/**",
        "packages/chain/chain-guard.js",
        "packages/chain/shard-manifest.js"
    ]
}

# The TypeScript an area's checks run, when narrower than its paths; otherwise every source file its paths match.
ENTRIES = {
    # The world job's only TypeScript; the vector and preset-fixture generators run under the native area.
    "native_world": ["contracts/l3/world-native/scripts/generate-schema.mjs"],
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


def selected_areas(files, landing):
    """The areas a diff of these files runs; a landing push runs every area."""
    return {area: landing or any(matches(path, SHARED + patterns) for path in files) for area, patterns in AREAS.items()}
