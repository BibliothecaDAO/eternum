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

- `src/cli.ts` — CLI router (run/init/doctor/--version)
- `src/index.ts` — main orchestration, live reconfiguration
- `src/config.ts` — env-driven config with defaults
- `src/world/` — world discovery, factory SQL resolution, manifest patching
- `src/session/` — Cartridge Controller session auth
- `src/adapter/` — EternumGameAdapter, action registry (60+ actions), world state builder, simulation
- `src/tui/` — terminal UI (app layout, world picker)
- `src/tools/` — extra inspect tools (realm, explorer, market, bank)
- `src/release/` — binary packaging for cross-platform releases

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

## Key Patterns

### Adapter Pattern

`EternumGameAdapter` implements the generic `GameAdapter<EternumWorldState>` interface from game-agent. This separates
Eternum-specific logic from the framework. `MutableGameAdapter` wraps it for hot-swapping on config changes.

### Action Registry

All 60+ game actions are registered in `adapter/action-registry.ts` using `register(type, description, params, handler)`.
Each handler receives `(client, signer, params)` and returns `{ success, txHash?, error? }`. Param values support
human-friendly suffixes (K/M/B/T) and are coerced via helpers like `num()`, `precisionAmount()`, `bigNumberish()`.

### World State Builder

`adapter/world-state.ts` fetches structures, armies, tiles, battles in parallel via `client.sql.*` and `client.view.*`,
filters to a 5-hex view radius around owned entities, enriches with guard strength, building slots, neighbor tiles, and
formats a structured tick prompt for the LLM.

### World Discovery

`world/discovery.ts` queries Factory SQL on slot/sepolia/mainnet chains, filters ended worlds, resolves contract
addresses, patches the base manifest with live addresses, and derives chain IDs from RPC URL slugs.

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
