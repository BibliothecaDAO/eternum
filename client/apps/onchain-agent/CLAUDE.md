# CLAUDE.md — onchain-agent

App-specific instructions for Claude Code when working in `client/apps/onchain-agent/`.

## What This App Is

**Axis** is an autonomous AI agent that plays the Eternum game on StarkNet. It runs as a terminal application (TUI +
CLI) with zero-config world discovery, browser-based Cartridge Controller authentication, and an LLM-driven tick loop
that observes game state and executes on-chain actions.

## Key Architecture

```
CLI (cli.ts) → index.ts orchestrates:
  1. World Discovery (world/) — queries Cartridge Factory SQL for active worlds
  2. Session Auth (session/) — Cartridge Controller Passkeys/WebAuthn
  3. Adapter Layer (adapter/) — bridges game-agent framework to Eternum
  4. Agent Creation — via @bibliothecadao/game-agent createGameAgent()
  5. TUI (tui/) — terminal UI with chat log and user input steering
  6. Heartbeat Loop — cron-style recurring jobs from HEARTBEAT.md
```

### Source Layout

- `src/cli.ts` — CLI router (all subcommands)
- `src/cli-args.ts` — CLI argument parser
- `src/index.ts` — TUI mode orchestration, live reconfiguration
- `src/headless.ts` — headless mode orchestration (NDJSON output, HTTP API, stdin)
- `src/config.ts` — env-driven config with defaults
- `src/commands/` — standalone CLI subcommands (worlds, auth, auth-status, auth-url)
- `src/world/` — world discovery, factory SQL resolution, manifest patching
- `src/session/` — Cartridge Controller session auth, artifact persistence, auth-approve, privatekey auth
- `src/adapter/` — EternumGameAdapter, action registry (60+ actions), world state builder, simulation
- `src/abi/` — ABI parser, action generator, executor, domain overlays, types
- `src/api/` — HTTP steering API server (node:http)
- `src/input/` — stdin JSON command reader
- `src/output/` — NDJSON event emitter with verbosity filtering
- `src/tui/` — terminal UI (app layout, world picker)
- `src/tools/` — extra inspect tools (realm, explorer, market, bank)
- `src/release/` — binary packaging for cross-platform releases
- `src/build-plugins.ts` — Bun build plugins (WASM embed + pi-config embed) for standalone binary
- `src/runtime-paths.ts` — bundled asset path resolution for standalone binary
- `src/shutdown-gate.ts` — graceful shutdown coordination primitive
- `build.ts` — two-step build script (bundle with plugins, then compile)

### Core Dependencies

- `@bibliothecadao/game-agent` — agent framework (tick loop, heartbeat, decision log, soul/personality, tools)
- `@bibliothecadao/client` — headless Eternum client (view queries, SQL, transactions, compute functions)
- `@bibliothecadao/torii` — Torii SQL utilities, factory queries, column definitions
- `@cartridge/controller` — browser-based session authentication (WASM)
- `@mariozechner/pi-agent-core` — LLM agent core (streaming, tool execution)
- `@mariozechner/pi-tui` — terminal UI primitives

## Build & Run

```bash
# From repo root:
pnpm install
pnpm --dir packages/types build
pnpm --dir packages/torii build
pnpm --dir packages/provider build
pnpm --dir packages/client build
pnpm --dir packages/game-agent build
pnpm --dir client/apps/onchain-agent build   # type-check
pnpm --dir client/apps/onchain-agent dev     # run
```

### Standalone Binary (requires Bun)

```bash
cd client/apps/onchain-agent
bun run build.ts --compile    # produces ./axis
cp axis ~/.local/bin/          # works anywhere, no adjacent files needed
```

## Key Patterns

### Adapter Pattern

`EternumGameAdapter` implements the generic `GameAdapter<EternumWorldState>` interface from game-agent. This separates
Eternum-specific logic from the framework. `MutableGameAdapter` wraps it for hot-swapping on config changes.

### Action Registry

All 60+ game actions are dynamically generated from the Starknet/Dojo manifest ABI via `initializeActions()` in
`adapter/action-registry.ts`. The ABI parser (`abi/parser.ts`) extracts entrypoints, `abi/action-gen.ts` generates
`ActionDefinition[]` and routing maps, and `abi/domain-overlay.ts` enriches raw ABI entries with Eternum-specific
descriptions, param transforms, and pre-flight validation. Param values support human-friendly suffixes (K/M/B/T) via
helpers like `num()` and `precisionAmount()` from the domain overlay module.

### World State Builder

`adapter/world-state.ts` fetches structures, armies, tiles, battles in parallel via `client.sql.*` and `client.view.*`,
filters to a 5-hex view radius around owned entities, enriches with guard strength, building slots, neighbor tiles, and
formats a structured tick prompt for the LLM.

### TUI Output Routing

After the TUI is created, never use `console.log`/`console.error` — it corrupts the differential renderer. Use the
`addSystemMessage()` function returned by `createApp()`. All post-TUI messages in `index.ts` route through a lazy
`systemMessage` callback.

### Build Plugins (`build-plugins.ts`)

Two Bun build plugins enable standalone binary:

- `wasmPlugin` — intercepts `@cartridge/controller-wasm` entry JS, embeds WASM as base64, instantiates with
  `__wbg_set_wasm()`
- `createPiConfigPlugin()` — patches `pi-coding-agent` config.js to embed `package.json` data, removing filesystem
  dependency

### Embedded Manifests

`world/discovery.ts` imports all 5 chain manifests (`manifest_slot.json`, etc.) directly via JSON imports. Bun inlines
these into the bundle. No filesystem reads at runtime.

### World Discovery

`world/discovery.ts` queries Factory SQL on slot/sepolia/mainnet chains, filters ended worlds, resolves contract
addresses, patches the base manifest with live addresses, and derives chain IDs from RPC URL slugs.

## Headless Mode

Axis supports fully headless operation for AI orchestrators and remote server fleets.

### CLI Commands

```bash
axis worlds [--json]                              # List discovered worlds
axis auth <world|--all> [--approve] [--json]      # Generate auth + persist artifacts
axis auth-status <world|--all> [--json]           # Check session validity
axis auth-url <world>                              # Print raw auth URL
axis run --headless --world=<name> [options]       # Run headlessly
```

### Headless Run Options

```bash
axis run --headless --world=<name>                 # NDJSON to stdout
  --auth=session|privatekey                        # Auth strategy (default: session)
  --api-port=<port> [--api-host=<host>]            # Enable HTTP steering API
  --stdin                                          # Enable stdin steering
  --verbosity=quiet|actions|decisions|all           # Output verbosity
```

### Artifact Directory

`axis auth` persists all artifacts to `~/.eternum-agent/.cartridge/<worldName>/`:
- `profile.json` — world profile (chain, rpc, torii, worldAddress)
- `manifest.json` — resolved manifest with live contract addresses
- `policy.json` — generated session policies
- `auth.json` — auth URL, status, metadata

### HTTP API (when --api-port is set)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /prompt | Send prompt to agent |
| GET | /status | Agent status |
| GET | /state | World state snapshot |
| GET | /events | SSE event stream |
| POST | /config | Update runtime config |
| POST | /shutdown | Graceful shutdown |

### Fleet Setup Example

```bash
axis auth --all --approve --method=password --json > /tmp/auth.json
for world in $(jq -r '.[].world' /tmp/auth.json); do
  axis run --headless --world="$world" --api-port=$((3000+RANDOM%1000)) &
done
```

### Design Docs

- `docs/plans/2026-02-21-headless-mode-design.md` — full design spec
- `docs/plans/2026-02-21-headless-mode-plan.md` — implementation plan

## Testing

```bash
pnpm --dir client/apps/onchain-agent test        # run tests
pnpm --dir client/apps/onchain-agent test:watch   # watch mode
```

## Debug Logs

All debug output goes to `~/.eternum-agent/data/debug-*.log`:

- `debug-world-state.log` — raw SQL ownership matches
- `debug-tick-prompt.log` — formatted tick prompt
- `debug-actions.log` — action results (OK/FAIL)
- `debug-actions-raw-errors.log` — raw Starknet errors
- `debug-tool-responses.log` — inspect tool responses

## Documentation

See `docs/` for detailed architecture docs:

- `docs/ARCHITECTURE.md` — full architecture reference
- `docs/DEPENDENCIES.md` — package dependency guide (torii, client, core)
- `docs/WORLD_PROFILE_AND_POLICY_PIPELINE.md` — world discovery pipeline spec
- `docs/ONCHAIN_AGENT_PIPELINE_REVIEW.md` — pipeline gap analysis
