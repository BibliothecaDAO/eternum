# Onchain Agent (CLI)

An autonomous AI agent that plays [Eternum](https://eternum.realms.world/) — a fully onchain strategy game on StarkNet.
It uses an LLM in a tick loop to observe game state, make decisions, and execute on-chain transactions via a headless
client.

## Getting Started

quick env (just use this it works, add anthropic key and then follow steps below)=

```bash
# World resolution — CHAIN + GAME_NAME + SLOT_NAME required.
# GAME_NAME = contract namespace for session policies (e.g., "eternum")
# SLOT_NAME = Torii instance slug for URL derivation (e.g., "test-snow-true-64")
# RPC_URL, TORII_URL, WORLD_ADDRESS, MANIFEST_PATH are auto-resolved from SLOT_NAME.
# Set them explicitly to override auto-resolution.
CHAIN=slot
GAME_NAME=eternum

# this one is live rn so use it po
SLOT_NAME=test-snow-true-64

# Cartridge Controller session
CHAIN_ID=0x57505f455445524e554d5f424c49545a5f534c4f545f33
SESSION_BASE_PATH=.cartridge

# LLM provider (see @mariozechner/pi-ai for supported providers)
# Anthropic
ANTHROPIC_API_KEY=
# OpenAI
OPENAI_API_KEY=

# Agent settings
TICK_INTERVAL_MS=60000
LOOP_ENABLED=true
MODEL_PROVIDER=anthropic
MODEL_ID=claude-sonnet-4-5-20250929
```

```bash
# 1. Install dependencies from the repo root
pnpm install

# 2. Build the workspace packages the agent depends on
pnpm --dir packages/game-agent build && pnpm --dir packages/torii build && pnpm --dir packages/client build

# 3. Create a .env file
cd client/apps/onchain-agent
cp .env.example .env   # then edit with your values

# 4. Start the agent, redirecting stderr (tx/action logs) to a file
pnpm dev 2>tx.log

# 5. On first run, the agent prints an auth URL to stdout.
#    Open it in an INCOGNITO browser tab, approve the session with your Cartridge account.

# 6. In a separate terminal, watch the transaction log
tail -f tx.log
```

> **Important:** The auth URL must be opened in an **incognito/private browser tab** — Cartridge Controller sessions can
> conflict with existing browser sessions.

> **After any changes to `packages/game-agent`, `packages/torii`, or `packages/client`**, you must rebuild before
> running the agent:
>
> ```bash
> pnpm --dir packages/game-agent build && pnpm --dir packages/torii build && pnpm --dir packages/client build
> ```

## Commands

```bash
pnpm dev                  # Run agent (requires .env, opens browser for auth on first run)
pnpm build                # Type-check only (no emit; app runs via tsx)
pnpm test                 # Run all tests (vitest --run)
pnpm test:watch           # Watch mode
npx vitest run test/adapter/action-registry.test.ts  # Single test file
npx vitest run -t "send_resources"                   # Single test by name
```

The `dev` script uses `node --env-file=.env --experimental-wasm-modules --import tsx` — no separate build step needed.

## Configuration

Required `.env` variables:

```bash
CHAIN=slot                          # slot, slottest, local, sepolia, mainnet
GAME_NAME=eternum                   # Game namespace for manifest tag filtering
SLOT_NAME=                          # Slot deployment name (defaults to GAME_NAME ie "test-snow-true-64" )
MODEL_PROVIDER=anthropic            # anthropic, openai, google, etc.
MODEL_ID=claude-sonnet-4-5-20250929 # Model ID
ANTHROPIC_API_KEY=sk-...            # API key for your chosen provider
```

Optional:

```bash
RPC_URL=                  # Override auto-resolved RPC
TORII_URL=                # Override auto-resolved Torii
WORLD_ADDRESS=            # Override auto-resolved world address
MANIFEST_PATH=            # Override auto-resolved manifest
CHAIN_ID=0x4b4154414e41   # StarkNet chain ID
SESSION_BASE_PATH=.cartridge
TICK_INTERVAL_MS=60000    # Milliseconds between tick cycles
LOOP_ENABLED=true         # Set false to disable auto-ticking
DATA_DIR=                 # Override data directory path
```

By default, the agent auto-resolves world config from the Cartridge Factory API based on `CHAIN` and `SLOT_NAME`. Set
`MANIFEST_PATH`, `WORLD_ADDRESS`, `TORII_URL`, and `RPC_URL` to skip auto-resolution.

## Cartridge Controller Authentication

The agent authenticates via the [Cartridge Controller](https://github.com/cartridge-gg/controller) session flow. No
private keys are stored in config.

### How it works

1. **Agent starts** — calls `ControllerSession.connect()`
2. **Existing session?** — checks `.cartridge/session.json` on disk. If a valid (non-expired) session exists, the agent
   reconnects immediately with no browser step.
3. **No session?** — the agent prints an auth URL to stdout.
4. **Human opens the URL in an incognito tab** — reviews the session policies and approves with their Cartridge account
   (Passkeys/WebAuthn).
5. **Callback received** — the browser redirects to the agent's local HTTP server. The session is saved to
   `.cartridge/session.json`.
6. **Agent is live** — the `SessionAccount` can now execute transactions. `executeFromOutside` is tried first
   (paymaster-sponsored, no gas needed), falling back to direct execution.

### Session persistence

The session persists to `SESSION_BASE_PATH` (default: `.cartridge/`). Restarting the agent reconnects from the stored
session without re-auth. Sessions have an expiration — when expired, the auth flow triggers again automatically.

Session policies are derived from manifest contract tags scoped by `GAME_NAME`.

## Architecture

```
[soul.md + tasks/*.md]  -->  system prompt (rebuilt each tick)
[tick loop]             -->  onTick -> buildWorldState -> formatTickPrompt -> agent.prompt()
[heartbeat loop]        -->  cron jobs from HEARTBEAT.md -> agent.enqueuePrompt()
[TUI]                   -->  pi-tui rendering + manual user steering via stdin
```

Data flow for actions:

```
LLM tool call -> execute_action(actionType, params)
  -> action-registry handler -> client.{domain}.{method}(signer, coerced_params)
    -> EternumProvider -> StarkNet transaction
```

The agent uses a **Gmail-pattern typed tool schema**: a single `execute_action` tool with a `StringEnum` for action
dispatch and typed optional params per action. The LLM sees every valid param name in the structured schema, and AJV
validates types before handlers run.

### Source Layout

```
src/
├── index.ts                    # Entry point: config, auth, agent lifecycle, runtime hot-swap
├── config.ts                   # Env var loader (CHAIN, RPC_URL, MODEL_*, etc.)
├── manifest-resolver.ts        # Auto-resolve world config from Cartridge Factory API
├── adapter/
│   ├── action-registry.ts      # Maps 40+ LLM action types -> client transaction calls
│   ├── world-state.ts          # Builds game state snapshot (player, market, leaderboard, map)
│   ├── eternum-adapter.ts      # GameAdapter implementation (getWorldState, executeAction, simulateAction)
│   ├── mutable-adapter.ts      # Hot-swappable adapter wrapper for runtime config changes
│   └── simulation.ts           # Dry-run simulation (combat strength, AMM swaps, building costs)
├── session/
│   └── controller-session.ts   # Cartridge Controller auth, session policies from manifest tags
└── tui/
    └── app.ts                  # Terminal UI (event log, user input, agent status)
```

### Runtime Data (in `data/`)

- `soul.md` — Agent identity, principles, decision framework (loaded into system prompt)
- `HEARTBEAT.md` — Cron-style recurring jobs (hot-reloaded at runtime, must use YAML format)
- `reflection.md` — Agent's self-written log of what worked and what failed
- `tasks/*.md` — Domain-specific strategy files (economy, military, exploration, diplomacy, priorities, reflection)

The agent can read and write all files in `data/` via `createReadTool`/`createWriteTool` from pi-coding-agent.

## HEARTBEAT.md Jobs (Cron-Style)

Recurring jobs are defined in `data/HEARTBEAT.md`. The scheduler hot-reloads this file during runtime, so edits apply
without restart.

Job format:

```yaml
version: 1
jobs:
  - id: market-check
    enabled: true
    schedule: "*/10 * * * *"
    mode: observe
    timeoutSec: 90
    prompt: |
      Check market conditions and summarize opportunities.
```

- `schedule` uses 5-field cron: `minute hour day month dayOfWeek`.
- `mode: observe` adds guidance not to execute on-chain actions.
- `mode: act` allows action-taking if the prompt decides it.
- The agent can manage this file itself via existing `read`/`write` tools.

## Live Self-Reconfiguration (No Restart)

The running agent can reconfigure itself through tools:

- `get_agent_config`: read live config
- `set_agent_config`: apply one or more live config changes

Supported config paths: `rpcUrl`, `toriiUrl`, `worldAddress`, `manifestPath`, `gameName`, `chainId`, `sessionBasePath`,
`tickIntervalMs`, `loopEnabled`, `modelProvider`, `modelId`, `dataDir`.

## Testing

Tests use Vitest with `test/utils/mock-client.ts` providing a comprehensive mock `EternumClient`.

```bash
pnpm test                 # Run all tests
pnpm test:watch           # Watch mode
```

```
test/
├── adapter/           # Unit tests for action-registry, world-state, simulation, adapters
├── e2e/               # Integration test with full pi-agent tools
├── session/           # Session policy tests
├── tui/               # TUI rendering tests
└── utils/mock-client.ts
```

## Key Dependencies

| Package                         | Role                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `@bibliothecadao/client`        | Headless Eternum client — views (reads) and transactions (writes)              |
| `@bibliothecadao/game-agent`    | Agent framework — `createGameAgent()`, tick loop, heartbeat, soul/task loading |
| `@bibliothecadao/torii`         | SQL query builders for Torii                                                   |
| `@mariozechner/pi-agent-core`   | Agent class — prompt/steer/followUp, event subscription, tool execution        |
| `@mariozechner/pi-ai`           | Model registry, TypeBox schemas for tool definitions                           |
| `@mariozechner/pi-tui`          | Terminal UI components                                                         |
| `@mariozechner/pi-coding-agent` | File tools — `createReadTool(dir)`, `createWriteTool(dir)` scoped to dataDir   |
