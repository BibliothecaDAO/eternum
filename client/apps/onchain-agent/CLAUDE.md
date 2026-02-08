# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An autonomous AI agent that plays [Eternum](https://eternum.realms.world/) (a fully onchain strategy game on StarkNet). It uses an LLM in a tick loop to observe game state, make decisions, and execute on-chain transactions via a headless client.

## Getting Started

```bash
# 1. Install dependencies from the repo root
pnpm install

# 2. Build the workspace packages the agent depends on
pnpm --dir packages/game-agent build && pnpm --dir packages/torii build && pnpm --dir packages/client build

# 3. Create a .env file (see Configuration section below)
cd client/apps/onchain-agent
cp .env.example .env   # then edit with your values

# 4. Start the agent, redirecting stderr (tx/action logs) to a file
pnpm dev 2>tx.log

# 5. On first run, the agent prints an auth URL to stdout.
#    Open it in an INCOGNITO browser tab, approve the session with your Cartridge account.

# 6. In a separate terminal, watch the transaction log
tail -f tx.log
```

> **After any changes to `packages/game-agent`, `packages/torii`, or `packages/client`**, you must rebuild before running the agent:
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

The `dev` script uses `node --env-file=.env --experimental-wasm-modules --import tsx` -- no separate build step.

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

The agent uses a **Gmail-pattern typed tool schema**: a single `execute_action` tool with a `StringEnum` for action dispatch and typed optional params per action. The LLM sees every valid param name in the structured schema, and AJV validates types before handlers run.

The `observe_game` tool returns an enriched world state that includes per-structure detail (guard slots, buildings, resource balances) and per-explorer detail (troop composition, carried resources, stamina), in addition to market, leaderboard, and map data.

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

- `soul.md` -- Agent identity, principles, decision framework (loaded into system prompt)
- `HEARTBEAT.md` -- Cron-style recurring jobs (hot-reloaded at runtime, must use YAML format)
- `reflection.md` -- Agent's self-written log of what worked and what failed
- `tasks/*.md` -- Domain-specific strategy files (economy, military, exploration, diplomacy, priorities, reflection)
- `decisions/` -- Decision log files (created by DecisionRecorder, currently not wired up)

The agent can read and write all files in `data/` via `createReadTool`/`createWriteTool` from pi-coding-agent.

### Key Dependencies

| Package | Role |
|---------|------|
| `@bibliothecadao/client` | Headless Eternum client -- `client.view.*` (reads), `client.resources.*`, `client.troops.*`, `client.combat.*`, etc. (writes) |
| `@bibliothecadao/game-agent` | Agent framework -- `createGameAgent()`, `createHeartbeatLoop()`, tick loop, decision recorder, soul/task loading |
| `@bibliothecadao/torii` | SQL query builders for Torii -- `FACTORY_QUERIES`, `buildApiUrl`, `SqlApi` |
| `@mariozechner/pi-agent-core` | Agent class -- prompt/steer/followUp, event subscription, tool execution, context management |
| `@mariozechner/pi-ai` | Model registry -- `getModel(provider, modelId)`, TypeBox `Type.*` and `StringEnum` for tool schemas |
| `@mariozechner/pi-tui` | Terminal UI -- `TUI`, `ProcessTerminal`, `Text`, `Markdown`, `Container` components |
| `@mariozechner/pi-coding-agent` | File tools -- `createReadTool(dir)`, `createWriteTool(dir)` scoped to dataDir |

### pi-agent-core Agent API (key methods)

```typescript
agent.prompt(text)              // Send a user message and run until done
agent.steer(message)            // Interrupt during tool execution (delivered after current tool)
agent.followUp(message)         // Queue work for after current prompt finishes
agent.abort()                   // Cancel current operation
agent.subscribe(fn)             // Listen to AgentEvents (message_end, tool_execution_*, etc.)
agent.setModel(model)           // Hot-swap LLM model
agent.setSystemPrompt(prompt)   // Update system prompt
agent.setTools(tools)           // Replace tool set
agent.state                     // Read-only: messages, isStreaming, model, tools, etc.
```

AgentMessage type narrowing: always use `msg.role` checks (e.g., `msg.role === "user"`) to narrow, not `"content" in msg`. pi-coding-agent extends AgentMessage with `BashExecutionMessage` and others via declaration merging.

### Action Registry Pattern (`src/adapter/action-registry.ts`)

All LLM actions are registered as handlers that coerce LLM params and call client methods:

```typescript
register("send_resources", (client, signer, params) =>
  wrapTx(() =>
    client.resources.send(signer, {
      senderEntityId: num(params.senderEntityId),
      recipientEntityId: num(params.recipientEntityId),
      resources: resourceList(params.resources),
    })
  )
);
```

Param names in action-registry handlers must match the param names in the Gmail-pattern schema in `packages/game-agent/src/tools.ts`. Coercion helpers (`num()`, `str()`, `bool()`) convert LLM values to typed params.

### Tool Schema Pattern (`packages/game-agent/src/tools.ts`)

The `execute_action` tool uses a Gmail-pattern schema:
- `actionType` is a `StringEnum` of all valid action names (from action-registry)
- Every param from every action appears as a `Type.Optional` field with a description noting which actions use it
- The tool description includes a "Required Params Per Action" reference
- AJV validates the schema before handlers run

### Config Resolution

- **Auto mode (default):** `resolveManifest(chain, slotName)` queries the Cartridge Factory API, fetches contract addresses, and patches the base manifest
- **Manual mode:** Set `MANIFEST_PATH`, `WORLD_ADDRESS`, `TORII_URL`, `RPC_URL` in `.env` to skip auto-resolution
- **Chain types:** `slot`, `slottest`, `local`, `sepolia`, `mainnet`

### Session Auth

Cartridge Controller session flow -- no private keys in config. On first run, the agent prints an auth URL. Open it in an **incognito browser tab** and approve with your Cartridge account. The session is saved to `.cartridge/session.json` and reused on subsequent runs. Session policies are derived from manifest contract tags scoped by `GAME_NAME`.

## Configuration

Required `.env` variables:

```bash
CHAIN=slot                          # slot, slottest, local, sepolia, mainnet
GAME_NAME=eternum                   # Game namespace for manifest tag filtering
SLOT_NAME=                          # Slot deployment name (defaults to GAME_NAME)
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

## Testing

Tests use Vitest with `test/utils/mock-client.ts` providing a comprehensive mock `EternumClient`.

```
test/
├── adapter/           # Unit tests for action-registry, world-state, simulation, adapters
├── e2e/               # Integration test with full pi-agent tools
├── session/           # Session policy tests
├── tui/               # TUI rendering tests
└── utils/mock-client.ts
```

Vitest config aliases workspace packages to source TS (not dist) so tests run against live source.

## Known Issues

- **HEARTBEAT.md must use YAML format** -- The heartbeat parser expects a ` ```yaml ``` ` code block with `version:` and `jobs:` keys. Freeform markdown with checkboxes (the current content) produces zero parsed jobs.
- **DecisionRecorder is wired up but never called** -- `recorder.record()` is never invoked. Decision logging is dead code.
- **`data/task_lists/priorities.md` is orphaned** -- Only `data/tasks/*.md` files are loaded into the system prompt. The `task_lists/` directory is not read.
- **Context trimming drops history without summary** -- Old messages are discarded entirely with no compaction summary. The agent loses memory of past decisions over long sessions.
- **World state enrichment is sequential** -- Per-structure and per-explorer detail queries run one-by-one instead of being parallelized with `Promise.all`.
- **`num()` does not validate** -- `Number(undefined)` produces `NaN` silently. The typed schema should prevent this, but there's no defensive check.

## Common Pitfalls

- **SQL column aliases must match TypeScript field access** -- e.g., if SQL returns `resources_packed`, TS must access `.resources_packed` not `.resources`
- **Param names in action-registry must match the tool schema** -- the Gmail-pattern schema in `tools.ts` is the source of truth. Do not add fallback aliases; fix the schema instead.
- **Session policies use contract entrypoint names** from the ABI, not the provider method names in the client
- **Auth URL must be opened in an incognito tab** -- Cartridge Controller sessions can conflict with existing browser sessions
- **Stderr is the action log** -- Run with `2>tx.log` and `tail -f tx.log` to see `[tx]` and `[action]` output from `wrapTx()` and `executeAction()`

## Adding a New Action

1. Add the action name to the `ACTION_TYPES` array in `packages/game-agent/src/tools.ts`
2. Add typed optional params for the action to the Gmail-pattern schema in `packages/game-agent/src/tools.ts` (each param gets a `Type.Optional` field with a description noting which actions use it)
3. Add the action to the "Required Params Per Action" section in the `EXECUTE_ACTION_DESCRIPTION` string in `tools.ts`
4. Add handler in `src/adapter/action-registry.ts` using `register()` -- param names must match the schema exactly
5. Add test in `test/adapter/action-registry.test.ts`
6. Optionally add simulation logic in `src/adapter/simulation.ts`
7. Update the strategy guide table in `data/soul.md` if the LLM needs strategic context
