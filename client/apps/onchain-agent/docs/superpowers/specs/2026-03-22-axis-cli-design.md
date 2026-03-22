# Axis CLI Design Spec

## Overview

A Commander.js-based CLI for the Eternum onchain agent, distributed as a single binary called `axis`. Provides three modes from one entry point:

1. **`axis run`** — full autonomous agent loop (Pi agent + tick loop + interactive stdin)
2. **`axis mcp`** — MCP server mode (stdio transport for Claude Code integration)
3. **`axis <command>`** — one-shot tool commands (bootstrap, execute, print, exit)

All three modes share a single bootstrap sequence and the same core tool functions.

## Design Principles

- **Minimal new surface area** — thin wrappers over existing code, not new abstractions
- **Same config story** — `.env` file in cwd or env vars, no new config format
- **One world at a time** — no world switching or multi-world management in v1
- **User brings their own API key** — `ANTHROPIC_API_KEY` or X402 credentials for `axis run`

## Command Structure

```
axis run                                              # autonomous agent loop
axis mcp                                              # MCP server mode
axis status                                           # check bootstrap / auth state

axis map briefing                                     # game state summary
axis map tile-info <x> <y>                            # what's at this position
axis map nearby <x> <y> [--radius 5]                  # what's around here
axis map entity-info <entity-id>                      # full entity details
axis map find <type> [--ref-x 5 --ref-y -3]           # find entities by type

axis automation status                                # check realm economy state
axis automation start                                 # only valid in `axis run` (persistent mode)
axis automation stop                                  # only valid in `axis run` (persistent mode)

axis move-army <army-id> <x> <y>                      # move with auto-pathfinding
axis simulate-attack <army-id> <x> <y>                # preview battle outcome
axis attack <army-id> <x> <y>                         # engage adjacent target
axis attack-from-guard <structure-id> <slot> <target-army-id>  # defensive strike
axis raid <army-id> <x> <y> [--steal '38:100,3:500']  # raid for loot

axis create-army <structure-id> [--type Knight --tier 1 --amount 500]
axis open-chest <army-id> <x> <y>

axis send-resources <from> <to> --resources '38:100,3:500'
axis guard-from-storage <structure-id> <slot> <type> <tier> <amount>
axis guard-from-army <army-id> <structure-id> <slot> <amount>
axis reinforce-army <army-id> <amount>
axis transfer-troops <from-army> <to-army> <amount>
axis unguard-to-army <structure-id> <slot> <army-id> <amount>
axis transfer-to-structure <army-id> <structure-id> --resources '38:100'
axis transfer-to-army <from-army> <to-army> --resources '38:100'
axis apply-relic <entity-id> <relic-resource-id> <recipient-type>
```

### Argument Conventions

- **Positional args** for required parameters (entity IDs, coordinates)
- **Flags** for optional parameters (`--type`, `--tier`, `--amount`, `--radius`)
- **Resource shorthand** for resource lists: `--resources '38:100,3:500'` (resource_id:amount pairs, comma-separated)
- **Global `--json` flag** outputs raw result object for scripting
- `axis map` is a subcommand group (5 related queries). All other commands are flat.

### Entity Type Values for `axis map find`

`hyperstructure`, `mine`, `village`, `chest`, `enemy_army`, `enemy_structure`, `own_army`, `own_structure`

## Architecture

### File Layout

```
src/
  cli/
    index.ts              # Commander program definition, global options, command registration
    parse-resources.ts    # shared '38:100,3:500' → ResourceAmount[] parser
    commands/
      run.ts              # axis run — agent loop wrapper
      mcp.ts              # axis mcp — MCP server wrapper
      map.ts              # axis map <subcommand> — 5 map query commands
      tools.ts            # all action commands (move-army, attack, create-army, etc.)
  entry/
    bootstrap-runtime.ts  # shared bootstrap() extracted from main.ts + mcp-server.ts
```

### Shared Bootstrap

Both `main.ts` and `mcp-server.ts` currently duplicate an ~80-line bootstrap sequence. This gets extracted into `src/entry/bootstrap-runtime.ts`:

```ts
interface BootstrapResult {
  config: AgentConfig;
  client: EternumClient;
  provider: EternumProvider;
  account: AccountInterface;
  gameConfig: GameConfig;
  mapCtx: MapContext;
  mapLoop: { start(): void; stop(): void; refresh(): Promise<void> };
  automationLoop: ReturnType<typeof createAutomationLoop>;
  automationStatus: AutomationStatusMap;
  toolCtx: ToolContext;
  // ToolContext includes donkeyCapacityGrams and resourceWeightGrams
  // (queried during bootstrap for send-resources donkey cost calculations)
}

async function bootstrap(opts?: {
  waitForMap?: boolean;      // default true — block until first map snapshot
  startMapLoop?: boolean;    // default true
  onAuthUrl?: (url: string) => void;  // callback when Cartridge prints auth URL
}): Promise<BootstrapResult>
```

When `waitForMap: true`, `toolCtx.snapshot` is guaranteed non-null. When `waitForMap: false` (MCP mode), `toolCtx.snapshot` starts as `null` and callers must gate on it.

The bootstrap sequence:

1. `loadConfig()` — read env vars / `.env`
2. `discoverWorld()` — resolve Torii URL + world address from `WORLD_NAME` (if set)
3. `getManifest()` + `patchManifest()` — load and patch contract manifest
4. `getAccount()` — Cartridge authentication (fires `onAuthUrl` callback if URL detected)
5. `EternumClient.create()` + `new EternumProvider()` — game clients
6. `fetchGameConfig()` — building costs, recipes, stamina config
7. Query `map_center_offset` for coordinate conversion
8. Query `donkey_capacity` and `WeightConfig` for transport cost calculations
9. `createMapLoop()` — background tile refresh
10. `createAutomationLoop()` — background economy (created but not started)
11. Wait for first map snapshot (if `waitForMap: true`)
12. Build `ToolContext` (including `donkeyCapacityGrams`, `resourceWeightGrams`)

### Mode Consumption

**`axis run`:**
- Calls `bootstrap()`
- Creates Pi agent with tools
- Starts tick loop + evolution engine + interactive stdin
- Stays alive until SIGINT

**`axis mcp`:**
- Redirects all console output to stderr (MCP protocol owns stdout)
- Connects MCP stdio transport first (instant handshake)
- Calls `bootstrap({ waitForMap: false, onAuthUrl })` in the background
- Tools return "not ready" until bootstrap completes
- Stays alive until stdin closes

**`axis <command>` (one-shot):**
- Calls `bootstrap({ waitForMap: true })`
- Calls the core tool function with parsed args
- Prints `result.message` to stdout (or JSON with `--json`)
- Exits with code 0 on success, 1 on failure

### .env Loading

The `loadConfig()` function reads `.env` from `cwd`. This is correct for the `axis` binary (users run it from their project directory). The current `mcp-server.ts` loads `.env` from the package directory instead (because Claude Code's cwd is unpredictable). For `axis mcp`, the user's cwd is predictable (they launch it themselves), so `loadConfig()`'s cwd-based loading is used uniformly. The package-relative fallback in `mcp-server.ts` is dropped.

### `axis status` Output

Prints bootstrap phase and account info:
- Pre-auth: `"Authenticating... Login URL: <url>"`
- Bootstrapping: `"Starting up (<phase>)..."`
- Ready: `"Ready. Account: <address>, World: <world-address>, Chain: <chain>"`
- Failed: `"Failed: <error>"`

### `axis automation` in One-Shot Mode

`axis automation status` works in one-shot mode — it bootstraps, queries realm state, prints it, exits. `axis automation start` and `axis automation stop` print an error in one-shot mode: `"start/stop only works in persistent mode (axis run)."` They are only meaningful when the process stays alive.

### Resource Shorthand Parser

A shared `parseResources(input: string): Array<{ resourceId: number; amount: number }>` utility lives in `src/cli/parse-resources.ts`. Parses `'38:100,3:500'` into `[{ resourceId: 38, amount: 100 }, { resourceId: 3, amount: 500 }]`. Used by all commands that accept `--resources` or `--steal`.

### Entry Point Changes

- `src/entry/index.ts` imports and runs the Commander program from `src/cli/index.ts`
- `dev/scripts/mcp-server.ts` replaces its inline bootstrap with a call to the shared `bootstrap()`

### Distribution Paths

Two independent distribution paths:

1. **Bun binary** (`build:binary`): Compiles `src/entry/index.ts` → `dist/axis` standalone executable. No Node.js required. For GitHub releases / direct download.
2. **npm/npx** (`bin` field): `"bin": { "axis": "./src/cli/index.ts" }` runs via `tsx` (already a dependency). For `npx @bibliothecadao/onchain-agent` usage. Requires Node.js.

## One-Shot Command Lifecycle

```
parse args → bootstrap (~5-10s) → execute tool → print result → exit
```

Bootstrap cost is ~5-10s per invocation (world discovery, auth, map load). Acceptable for v1 since the commands inherently involve chain interaction.

### Output

- **Default:** Plain text — the `.message` string from the core tool function
- **`--json`:** Raw result object (`{ success, message }`) as JSON to stdout

### Error Handling

- Bootstrap failures (bad config, auth timeout, network): print to stderr, exit 1
- Tool failures (`result.success === false`): print `result.message` to stderr, exit 1
- No retries, no interactive prompts in one-shot mode

## Distribution

### Binary Build

The existing `build:binary` Bun script targets the CLI entry point. Output: a single `axis` executable.

### Installation

- **Binary download:** GitHub releases (or similar)
- **npm:** `npx @bibliothecadao/onchain-agent` (uses `bin` field in package.json)

### Configuration

Same as today — no changes:

```env
# Required
CHAIN=slot                    # slot | sepolia | mainnet | slottest
WORLD_NAME=xbt5               # auto-discovers Torii URL + world address

# Required for `axis run`
ANTHROPIC_API_KEY=sk-...       # or X402 credentials

# Optional
MODEL_ID=claude-sonnet-4-20250514
TICK_INTERVAL_MS=60000
```

### MCP Registration

```
claude mcp add eternum -- axis mcp
```

## Dependencies

- **Add:** `commander` (~50KB) as a production dependency
- **Add:** `zod` as an explicit production dependency (currently transitive via `@modelcontextprotocol/sdk`, but `axis mcp` uses it directly for tool schemas)
- **Move:** `@modelcontextprotocol/sdk` from devDependencies to dependencies (needed by `axis mcp`)

## Scope Boundaries (v1)

### In scope
- Commander CLI with three modes (run, mcp, one-shot commands)
- Shared bootstrap extraction
- All 22 tool commands
- Global `--json` flag
- Binary distribution via existing Bun build

### Out of scope (future)
- `axis init` setup wizard
- Multi-world management / world switching
- Daemon mode for faster one-shot commands
- Shell completions
- Config file format (TOML/YAML) — env vars only for now
