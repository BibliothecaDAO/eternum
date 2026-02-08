# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An autonomous AI agent that plays [Eternum](https://eternum.realms.world/) (a fully onchain strategy game on StarkNet). It uses an LLM in a tick loop to observe game state, make decisions, and execute on-chain transactions via a headless client.

## Commands

```bash
pnpm dev                  # Run agent (requires .env, opens browser for auth on first run)
pnpm build                # Type-check only (no emit; app runs via tsx)
pnpm test                 # Run all tests (vitest --run)
pnpm test:watch           # Watch mode
npx vitest run test/adapter/action-registry.test.ts  # Single test file
npx vitest run -t "send_resources"                   # Single test by name
```

The `dev` script uses `node --env-file=.env --experimental-wasm-modules --import tsx` — no separate build step.

## Architecture

```
SQL (Torii) → ViewClient → buildWorldState() → LLM → action-registry → EternumClient txs → StarkNet
```

The agent uses a **Gmail-pattern typed tool schema**: a single `execute_action` tool with a `StringEnum` for action dispatch and typed optional params per action. The LLM sees every valid param name in the structured schema, and AJV validates types before handlers run. This replaces the previous untyped `Record<string, unknown>` approach.

The `observe_game` tool returns an enriched world state that includes per-structure detail (guard slots, buildings, resource balances) and per-explorer detail (troop composition, carried resources, stamina), in addition to market, leaderboard, and map data.

### Source Layout

```
src/
├── index.ts                    # Entry point: config, auth, agent lifecycle, runtime hot-swap
├── config.ts                   # Env var loader (CHAIN, RPC_URL, MODEL_*, etc.)
├── manifest-resolver.ts        # Auto-resolve world config from Cartridge Factory API
├── adapter/
│   ├── action-registry.ts      # Maps 40+ LLM action types → client transaction calls
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

- `soul.md` — Agent identity, principles, decision framework
- `HEARTBEAT.md` — Cron-style recurring jobs (hot-reloaded at runtime)
- `tasks/*.md` — Domain-specific strategy files (economy, military, exploration, etc.)

### Key Workspace Dependencies

| Package | Role |
|---------|------|
| `@bibliothecadao/client` | Headless Eternum client — `client.view.*` (reads), `client.resources.*`, `client.troops.*`, `client.combat.*`, etc. (writes) |
| `@bibliothecadao/game-agent` | Agent framework — `createGameAgent()`, `createHeartbeatLoop()`, `GameAdapter` interface, `RuntimeConfigManager` |
| `@bibliothecadao/torii` | SQL query builders for Torii — `FACTORY_QUERIES`, `buildApiUrl`, `SqlApi` |

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

Param names in action-registry handlers must match the param names in the Gmail-pattern schema in `packages/game-agent/src/tools.ts`. The typed schema ensures the LLM always sends the correct param names, so no fallback aliases are needed. Coercion helpers (`num()`, `str()`, `bool()`) validate types and throw on NaN rather than silently passing bad values to StarkNet.

### Tool Schema Pattern (`packages/game-agent/src/tools.ts`)

The `execute_action` tool uses a Gmail-pattern schema:
- `actionType` is a `StringEnum` of all valid action names (from action-registry)
- Every param from every action appears as a `Type.Optional` field with a description noting which actions use it
- The tool description includes a "Required Params Per Action" reference listing exactly which params each action needs
- AJV validates the schema before handlers run, rejecting invalid action names and wrong param types

The `simulate_action` tool uses the same pattern.

### Config Resolution

- **Manual mode:** Set `MANIFEST_PATH`, `WORLD_ADDRESS`, `TORII_URL`, `RPC_URL` in `.env`
- **Auto mode:** If any are missing, `resolveManifest(chain, slotName)` fetches from Cartridge Factory API
- **Chain types:** `slot`, `slottest`, `local`, `sepolia`, `mainnet`
- **Chain IDs:** `KATANA` = `0x4b4154414e41`, `SN_MAIN` = `0x534e5f4d41494e`, `SN_SEPOLIA` = `0x534e5f5345504f4c4941`

### Session Auth

Cartridge Controller session flow — no private keys in config. Agent prints a URL, human approves in browser, session saved to `.cartridge/session.json`. Session policies are derived from manifest contract tags scoped by `GAME_NAME`.

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

## Common Pitfalls

- **SQL column aliases must match TypeScript field access** — e.g., if SQL returns `resources_packed`, TS must access `.resources_packed` not `.resources`
- **Param names in action-registry must match the tool schema** — the Gmail-pattern schema in `tools.ts` is the source of truth for param names. Do not add fallback aliases; fix the schema instead.
- **`num()` coercion must validate** — `Number(undefined)` silently produces `NaN` which causes `felt()` to crash in StarkNet
- **Session policies use contract entrypoint names** from the ABI, not the provider method names in the client
- **Enriched world state is larger** — `buildWorldState()` now calls `realm()`, `explorer()`, `bank()`, `events()`, and `hyperstructure()` in addition to the original `player()`, `market()`, `leaderboard()`, `mapArea()`. This provides the entity IDs and context the LLM needs to construct correct action params.

## Adding a New Action

1. Add the action name to the `ACTION_TYPES` array in `packages/game-agent/src/tools.ts`
2. Add typed optional params for the action to the Gmail-pattern schema in `packages/game-agent/src/tools.ts` (each param gets a `Type.Optional` field with a description noting which actions use it)
3. Add the action to the "Required Params Per Action" section in the `EXECUTE_ACTION_DESCRIPTION` string in `tools.ts`
4. Add handler in `src/adapter/action-registry.ts` using `register()` — param names must match the schema exactly
5. Add test in `test/adapter/action-registry.test.ts`
6. Optionally add simulation logic in `src/adapter/simulation.ts`
7. Update the strategy guide table in `data/soul.md` if the LLM needs strategic context
