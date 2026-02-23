# Onchain Agent Architecture

**Axis** is an autonomous AI agent that plays the Eternum game on StarkNet. It runs as a terminal application (TUI +
CLI), connecting to game worlds via Cartridge Controller sessions and executing on-chain actions through an LLM-driven
agent loop.

## Purpose

The onchain-agent app (`client/apps/onchain-agent/`) provides:

1. **Zero-config world discovery** — automatically finds and connects to active Eternum game worlds on
   slot/sepolia/mainnet chains via the Cartridge Factory SQL API
2. **Browser-based authentication** — uses Cartridge Controller sessions (Passkeys/WebAuthn) without storing private
   keys locally
3. **Autonomous gameplay** — tick-based agent loop with LLM decision-making, action execution, and optional cron-style
   recurring jobs
4. **Live reconfiguration** — runtime config updates (RPC URLs, tick intervals, model selection) without restart
5. **Standalone binary packaging** — Bun-compiled cross-platform releases for darwin/linux (x64/arm64)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  CLI (cli.ts)                                               │
│  ├─ run:    main() → world discovery → session → agent     │
│  ├─ init:   scaffold data/session directories              │
│  ├─ doctor: validate config/paths/API keys                 │
│  └─ --version                                               │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  Entry Point (index.ts)                                     │
│  └─ main() orchestrates:                                    │
│     1. World Discovery (world/)                             │
│     2. Session Auth (session/)                              │
│     3. Game Adapter (adapter/)                              │
│     4. Agent Creation (@bibliothecadao/game-agent)          │
│     5. TUI Launch (tui/)                                    │
│     6. Heartbeat Loop                                       │
└─────────────────────────────────────────────────────────────┘
                        ↓
    ┌───────────────────────────────────────────────────────┐
    │  World Discovery (world/)                             │
    │  ├─ discovery.ts:     orchestrate multi-chain query   │
    │  ├─ factory-sql.ts:   parse Factory SQL responses     │
    │  ├─ factory-resolver: resolve contracts, deployments  │
    │  ├─ manifest-patcher: patch manifest with live addrs  │
    │  └─ normalize.ts:     RPC URL, chain ID normalization │
    └───────────────────────────────────────────────────────┘
                        ↓
    ┌───────────────────────────────────────────────────────┐
    │  Session Management (session/)                        │
    │  └─ controller-session.ts: Cartridge Controller auth │
    │     ├─ buildSessionPoliciesFromManifest()             │
    │     ├─ probe():   check existing session on disk      │
    │     └─ connect(): browser auth flow (5-min timeout)   │
    └───────────────────────────────────────────────────────┘
                        ↓
    ┌───────────────────────────────────────────────────────┐
    │  Adapter Layer (adapter/)                             │
    │  ├─ eternum-adapter.ts:  GameAdapter impl (EternumClient) │
    │  ├─ mutable-adapter.ts:  hot-swappable adapter proxy │
    │  ├─ action-registry.ts:  60+ action handlers          │
    │  ├─ world-state.ts:      buildWorldState(), format    │
    │  └─ simulation.ts:       dry-run action estimates     │
    └───────────────────────────────────────────────────────┘
                        ↓
    ┌───────────────────────────────────────────────────────┐
    │  Agent Core (@bibliothecadao/game-agent)              │
    │  └─ createGameAgent(): tick loop, tools, LLM driver  │
    └───────────────────────────────────────────────────────┘
                        ↓
    ┌───────────────────────────────────────────────────────┐
    │  TUI (tui/)                                           │
    │  ├─ app.ts:          header, chat log, input editor   │
    │  └─ world-picker.ts: interactive world selector       │
    └───────────────────────────────────────────────────────┘
```

## Entry Points

### cli.ts

CLI router supporting four commands:

- **`run`** (default) — prints ASCII banner, imports `./index`, calls `main()`, exits on SIGINT/SIGTERM
- **`init`** — scaffolds `~/.eternum-agent/data/` (soul.md, HEARTBEAT.md, tasks/), `~/.eternum-agent/.cartridge/`, and
  `.env.example`
- **`doctor`** — validates config paths, manifest existence, API keys, directory writability
- **`--version`** — reads version from `package.json`

**Bundling:** `resolveBundledPath()` detects Bun binary runtime (`$bunfs` in import.meta.url) and resolves paths
relative to `process.execPath` instead of module location.

### index.ts

Main orchestration flow:

1. **Load config** (`loadConfig()` from `config.ts`) — env vars + defaults
2. **World discovery** (if RPC/Torii/WorldAddress not all set) — `discoverAllWorlds()` queries Factory SQL on
   slot/sepolia/mainnet, filters by game status (skip ended worlds), presents TUI picker or auto-selects by `SLOT_NAME`.
   Builds `WorldProfile` with live contract addresses and `resolvedManifest` via `buildResolvedManifest()`
3. **Session setup** — `ControllerSession.connect()` checks for existing session on disk, launches browser auth if
   needed
4. **Create runtime services** — `EternumClient`, `SessionAccount`, `EternumGameAdapter`, wrapped in
   `MutableGameAdapter` for hot-swap
5. **Create game agent** — `createGameAgent()` from `@bibliothecadao/game-agent` with:
   - `adapter`: game world interface
   - `dataDir`: `~/.eternum-agent/data/` (soul.md, tasks/, HEARTBEAT.md)
   - `model`: `getModel(provider, modelId)` from `@mariozechner/pi-ai`
   - `tickIntervalMs`: default 60000 (1 min)
   - `runtimeConfigManager`: hot-reload config changes
   - `extraTools`: `createInspectTools(client)` for detailed queries
   - `actionDefs`: `getActionDefinitions()` from action registry
   - `formatTickPrompt`: `formatEternumTickPrompt` from world-state
6. **Launch TUI** — `createApp({ agent, ticker })` renders header, chat log, input area. Returns `addSystemMessage`
   which is assigned to a `systemMessage` lazy reference used by all post-TUI logging (config changes, shutdown
   messages, errors)
7. **Start loops** — `ticker.start()` if `loopEnabled`, `heartbeat.start()` for cron-style jobs
8. **Graceful shutdown** — `createShutdownGate()` returns a promise that resolves on SIGINT/SIGTERM, cleans up
   agent/ticker/client

**Live reconfiguration:** `applyChangesInternal()` supports hot-swapping RPC/Torii/WorldAddress (reconnects session +
client), tick interval, model provider/ID, loop enabled/disabled, and data directory. `CONFIG_PATH_ALIASES` maps dotted
paths (e.g. `world.rpcUrl`) to flat config keys.

### config.ts

Env-driven configuration with fallback defaults:

- **CHAIN** (default: `slot`) → chain ID fallback
- **RPC_URL**, **TORII_URL**, **WORLD_ADDRESS** — if all set, skips world discovery
- **MANIFEST_PATH** — optional, only needed when bypassing world discovery
- **GAME_NAME** (default: `eternum`) — filters manifest tags for session policies
- **CHAIN_ID** — auto-derived from RPC URL slug (e.g. `WP_ETERNUM_BLITZ_SLOT_3` for Katana, `SN_MAIN`/`SN_SEPOLIA` for
  L1)
- **SESSION_BASE_PATH** (default: `~/.eternum-agent/.cartridge/`) — session.json storage
- **TICK_INTERVAL_MS** (default: 60000) — tick loop interval
- **LOOP_ENABLED** (default: true) — auto-start tick loop
- **MODEL_PROVIDER** (default: `anthropic`), **MODEL_ID** (default: `claude-sonnet-4-5-20250929`)
- **DATA_DIR** (default: `~/.eternum-agent/data/`) — soul, tasks, HEARTBEAT
- **ETERNUM_AGENT_HOME** (default: `~/.eternum-agent`) — base directory for all paths

`parseChain()`, `parseBoolean()`, `parsePositiveIntervalMs()` handle string→typed coercion with fallbacks.

### runtime-paths.ts

Path resolution for bundled vs. dev environments:

- **`isBunBinaryRuntime()`** — detects Bun compiled binary (`$bunfs` or `~BUN` in import.meta.url)
- **`resolveBundledPath(...segments)`** — returns path relative to binary location (bundled) or package root (dev)
- **`resolveAgentHome(env)`** — `$ETERNUM_AGENT_HOME` or `~/.eternum-agent`
- **`resolveDefaultManifestPath()`**, **`resolveDefaultDataDir()`**, **`resolveDefaultSessionBasePath()`** — derive
  default paths from agent home

Used by CLI init/doctor and config loading.

## World Discovery & Factory System

The agent auto-discovers active game worlds by querying the Cartridge Factory SQL API, eliminating manual
RPC/Torii/WorldAddress configuration.

### discovery.ts

**Core flow:**

1. **`discoverAllWorlds()`** — parallel queries to Factory SQL on slot/sepolia/mainnet
2. For each chain:
   - Query `[wf-WorldDeployed]` table for world names (decoded from felt252)
   - Check `https://api.cartridge.gg/x/{worldName}/torii/sql` availability
   - Query `s1_eternum-WorldConfig` for `start_main_at`, `end_at` timestamps
   - Derive `GameStatus` (upcoming/ongoing/ended/unknown)
   - Filter out unavailable or ended worlds
3. Return `DiscoveredWorld[]` with `{ name, chain, status }`
4. **Auto-selection:** if `SLOT_NAME` env var matches a discovered world, skip TUI picker
5. **TUI picker:** interactive `SelectList` (arrow keys, Enter, Esc/Ctrl+C)
6. **`buildWorldProfile(chain, worldName)`** — resolve contract addresses, RPC URL, token addresses:
   - Calls `resolveWorldContracts()` → Factory SQL query for contract addresses by selector
   - Calls `resolveWorldDeploymentFromFactory()` → extracts world address, RPC URL
   - Queries `s1_eternum-WorldConfig` for entry token, fee token addresses
   - Returns `WorldProfile` with
     `{ name, chain, toriiBaseUrl, rpcUrl, worldAddress, contractsBySelector, entryTokenAddress, feeTokenAddress, fetchedAt }`
7. **`buildResolvedManifest(chain, profile)`** — patches base manifest:
   - Loads `contracts/game/manifest_{chain}.json` from repo
   - Calls `patchManifestWithFactory()` to replace contract addresses with live Factory addresses
   - Returns patched manifest ready for session policy construction

**Chain URLs:**

- Factory SQL: `https://api.cartridge.gg/x/eternum-factory-{chain}/torii/sql` (slot-a for slot/slottest/local)
- Torii: `https://api.cartridge.gg/x/{worldName}/torii`
- RPC fallback: `https://api.cartridge.gg/x/eternum-blitz-slot-3/katana` (slot),
  `https://api.cartridge.gg/x/starknet/{sepolia|mainnet}` (L1)

### factory-resolver.ts

**Contract & deployment resolution:**

- **`resolveWorldContracts(factorySqlBaseUrl, worldName)`** — queries Factory SQL `[wf-WorldContractRegistered]` table,
  returns `Record<normalizedSelector, contractAddress>`
- **`resolveWorldDeploymentFromFactory(factorySqlBaseUrl, worldName)`** — queries `[wf-WorldDeployed]` table, extracts
  `worldAddress` and `rpcUrl` from nested `data` field or direct columns
- **`isToriiAvailable(toriiBaseUrl)`** — HEAD request to `/sql` endpoint

**SQL query helper:** uses `buildApiUrl()` and `fetchWithErrorHandling()` from `@bibliothecadao/torii`.

### factory-sql.ts

**Felt252 decoding & SQL helpers:**

- **`decodePaddedFeltAscii(hex)`** — converts padded felt252 hex to ASCII string (using
  `shortString.decodeShortString()` from starknet.js, fallback to manual decode)
- **`extractNameFelt(row)`** — extracts `name` field from SQL row (direct column or nested `data.name`)
- **`fetchFactoryRows(factorySqlBaseUrl, query)`** — GET request with query string, returns JSON array

### manifest-patcher.ts

**Manifest address patching:**

- **`patchManifestWithFactory(baseManifest, worldAddress, contractsBySelector)`** — deep clone manifest, update
  `world.address`, map `contracts[].address` by matching `selector` to Factory-resolved addresses
- Returns patched manifest ready for `ControllerSession` policy construction

### normalize.ts

**String normalization:**

- **`normalizeSelector(v)`** — left-pad hex to 64 chars, lowercase, prefix `0x`
- **`nameToPaddedFelt(name)`** — encode ASCII string to felt252 hex
- **`deriveChainIdFromRpcUrl(rpcUrl)`** — extract chain ID from URL pathname:
  - `/starknet/mainnet` → `SN_MAIN` (0x534e5f4d41494e)
  - `/starknet/sepolia` → `SN_SEPOLIA` (0x534e5f5345504f4c4941)
  - `/x/{slug}/katana` → `WP_{SLUG_UPPERCASE}` (e.g. `WP_ETERNUM_BLITZ_SLOT_3`)
- **`normalizeRpcUrl(value)`** — append `/rpc/v0_9` to Cartridge Katana/StarkNet URLs if missing

## Session Management

### controller-session.ts

Cartridge Controller session authentication via browser-based Passkeys/WebAuthn flow.

**Core class:** `ControllerSession`

**Constructor params:**

- `rpcUrl`: StarkNet RPC endpoint
- `chainId`: chain identifier (derived from RPC URL or env)
- `gameName`: game namespace (default `eternum`, used to filter manifest tags)
- `basePath`: session storage directory (default `~/.eternum-agent/.cartridge/`)
- `manifest`: game contract manifest (patched with Factory addresses)
- `worldProfile`: optional, provides entry/fee token addresses

**Methods:**

1. **`probe()`** — checks for existing valid session on disk at `basePath/session.json`, returns `WalletAccount` if
   found and not expired, otherwise `null`. No browser flow.
2. **`connect()`** — full auth flow:
   - Calls `probe()` first
   - If no session, prints auth URL to stdout, opens browser via `execFile(open/xdg-open)`
   - Waits up to 5 minutes for user to approve session in browser
   - Callback saves session to disk, returns `SessionAccount`
   - Throws if timeout or auth fails

**Session policies:** `buildSessionPoliciesFromManifest()` constructs Cartridge policies from manifest tags:

- **System contracts:** all Eternum systems (`resource_systems`, `troop_management_systems`, `trade_systems`,
  `production_systems`, etc.) with per-entrypoint policies (e.g. `send`, `create_explorer`, `create_order`,
  `create_building`)
- **VRF provider:** `0x051fea4...ced8f` with `request_random` entrypoint for verifiable randomness
- **Entry token:** `token_lock` entrypoint (if `worldProfile.entryTokenAddress` provided)
- **Fee token:** `approve` entrypoint (if `worldProfile.feeTokenAddress` provided)
- **Message signing:** `s1_eternum-Message` typed data policy for in-game chat (chain-specific domain:
  `SN_MAIN`/`SN_SEPOLIA`)

**Policy method registry:** `POLICY_METHODS_BY_SUFFIX` maps manifest tags to method arrays. Each method has
`{ name, entrypoint, description? }`.

**Tag filtering:** `tagMatchesGame(tag, gameName)` checks if tag contains game namespace (e.g.
`s1_eternum-resource_systems` matches `eternum`).

**Session persistence:** `SessionProvider` from `@cartridge/controller/session/node` stores session at
`basePath/session.json`. Session contains:

- Public key
- Signature policies
- Expiration timestamp
- Account credentials (managed by Controller, not exposed as plaintext private keys)

**Transaction execution:** `SessionAccount` tries `executeFromOutside` (paymaster-sponsored, no gas) first, falls back
to direct execution if paymaster unavailable.

## Adapter Layer

The adapter bridges the generic agent framework (`@bibliothecadao/game-agent`) to Eternum-specific game logic.

### eternum-adapter.ts

**`EternumGameAdapter` implements `GameAdapter<EternumWorldState>`:**

- **`getWorldState()`** — calls `buildWorldState(client, accountAddress)` to fetch all entities, player stats, market,
  leaderboard
- **`executeAction(action)`** — dispatches to `executeAction(client, signer, action)` from action registry
- **`simulateAction(action)`** — calls `simulateAction(action)` for dry-run estimates

**Constructor deps:** `EternumClient` (headless game client), `Account` (signer), `accountAddress` (player address)

### mutable-adapter.ts

**`MutableGameAdapter<TState>` — hot-swappable adapter proxy:**

Wraps an underlying `GameAdapter` with `setAdapter(next)` for runtime replacement. All methods (`getWorldState`,
`executeAction`, `simulateAction`, `subscribe?`) forward to `current` adapter.

**Use case:** hot-swapping RPC/Torii/WorldAddress without restarting the agent — `index.ts` creates a
`MutableGameAdapter` around `EternumGameAdapter`, then swaps the inner adapter on config changes.

### action-registry.ts

**Action handler registry** — 60+ action types for Eternum gameplay.

**Core pattern:**

1. **`register(type, description, params, handler)`** — stores handler + definition in `Map<string, RegistryEntry>`
2. **`registerAliases(types[], description, params, handler)`** — multiple types share one definition (e.g.
   `create_order`/`create_trade`)
3. **`executeAction(client, signer, action)`** — looks up handler, calls `wrapTx(() => handler(...))`, logs raw errors
   to `debug-actions-raw-errors.log`, logs action results to `debug-actions.log`
4. **`getActionDefinitions()`** — returns all action definitions (deduplicated by reference) for LLM tool descriptions

**Action categories:**

- **Resources:** `send_resources`, `pickup_resources`, `claim_arrivals`
- **Troops:** `create_explorer`, `add_to_explorer`, `delete_explorer`, `add_guard`, `delete_guard`, `move_explorer`,
  `travel_explorer`, `explore`, `swap_explorer_to_explorer`, `swap_explorer_to_guard`, `swap_guard_to_explorer`
- **Combat:** `attack_explorer`, `attack_guard`, `guard_attack_explorer`, `raid`
- **Trade:** `create_order`, `accept_order`, `cancel_order` (+ aliases)
- **Buildings:** `create_building`, `destroy_building`, `pause_production`, `resume_production`
- **Bank:** `buy_resources`, `sell_resources`, `add_liquidity`, `remove_liquidity`
- **Guild:** `create_guild`, `join_guild`, `leave_guild`, `update_whitelist`
- **Realm:** `upgrade_realm`
- **Hyperstructure:** `contribute_hyperstructure`

**Param schema helpers:**

- `n(name, desc)` → number
- `s(name, desc)` → string
- `b(name, desc)` → boolean
- `na(name, desc)` → number[]
- `oa(name, desc)` → object[]

**Coercion helpers:**

- `num(v)` — parse number, handle suffixes (K/M/B/T), strip commas
- `precisionAmount(v)` — multiply by `RESOURCE_PRECISION` (1e9) for on-chain amounts
- `bigNumberish(v)` — convert to BigInt or hex string (addresses)
- `resourceList(v)` → `{ resourceType: number, amount: number }[]`
- `stealResourceList(v)` → `{ resourceId: number, amount: number }[]`
- `liquidityCalls(v)` → `{ resourceType, resourceAmount, lordsAmount }[]`

**Error extraction:** `extractErrorMessage(err)` parses Starknet revert reasons:

- Looks for `Transaction failed with reason:`, `Failure reason:`, `execution reverted`, `execution_revert`, decoded
  felt252 error codes
- Decodes felt252 hex strings to ASCII labels (e.g. `0x...` → `argent/multicall-failed`)
- Truncates generic errors to 200 chars

**Action result wrapping:** `wrapTx(fn)` normalizes transaction responses:

- Success: `{ success: true, txHash, data: { transactionHash } }`
- Failure: `{ success: false, error: extractedMessage }`

**Reference strings:** `RESOURCE_IDS`, `BUILDING_TYPES`, `BUILDING_GUIDE`, `DIR`, `TROOP_CATEGORY`, `TROOP_TIER`
embedded in param descriptions for LLM context.

### world-state.ts

**World state snapshot builder** — queries SQL APIs and view APIs in parallel, enriches entities with game-specific
fields, formats human-readable tick prompt.

**Core types:**

- **`EternumEntity`** — unified entity representation:
  - Common: `type`, `entityId`, `owner`, `ownerName`, `isOwned`, `position`, `lastAttack`, `lastDefense`, `actions`
  - Structure-specific: `structureType`, `level`, `guardStrength`, `guardSummary`, `guardSlots`, `resources`,
    `productionBuildings`, `buildingSlots`, `population`, `nextUpgrade`, `armies`, `troopsInReserve`, `freeSlots`
  - Army-specific: `strength`, `stamina`, `isInBattle`, `troopSummary`, `neighborTiles`
- **`EternumWorldState extends WorldState<EternumEntity>`** — adds:
  - `player`: { address, name, structures, armies, points, rank }
  - `market`: { recentSwapCount, openOrderCount }
  - `leaderboard`: { topPlayers[], totalPlayers }
  - `recentBattles`: { type, attackerId, defenderId, winnerId?, raidSuccess?, yours, timestamp }[]

**`buildWorldState(client, accountAddress)`:**

1. **Parallel fetch:**
   - `client.view.player(accountAddress)` — player stats
   - `client.view.market()` — market state
   - `client.view.leaderboard({ limit: 10 })` — top 10
   - `client.sql.fetchAllStructuresMapData()` — raw structure rows
   - `client.sql.fetchAllArmiesMapData()` — raw army rows
   - `client.sql.fetchAllTiles()` — biome, occupier info
   - `client.sql.fetchBattleLogs()` — recent battles
2. **Visibility filter:**
   - Collect positions of all owned entities (structures + armies)
   - Filter nearby entities to `VIEW_RADIUS` (5 hexes) around any owned position
3. **Enrich structures:**
   - Parse guard slots (alpha/bravo/charlie/delta) → `guardStrength`, `guardSummary`, `guardSlots`
   - Unpack `packed_counts_1/2/3` → building counts per category → `buildingSlots`, `population`
   - Compute free building slots (direction paths) → `freeSlots` (e.g. `["[0]", "[1,2]"]`)
   - Lookup next realm upgrade → `nextUpgrade` (null if max level Empire)
   - Parse battle history → `lastAttack`, `lastDefense` with attacker/defender ID, timestamp, position
4. **Enrich armies:**
   - Parse troop count, tier → `strength`, `stamina`, `troopSummary`
   - Compute neighbor tiles (6 hex neighbors) → `neighborTiles` with
     `{ direction, dirId, explored, occupied, biome, occupant, occupantId }`
5. **Fetch per-structure resources & buildings:**
   - `client.sql.fetchResourceBalancesAndProduction(ownedEntityIds)` → parse `RESOURCE_BALANCE_COLUMNS` and production
     building counts
   - `client.sql.fetchBuildingsByStructures(ownedEntityIds)` → occupied inner coords
   - Group by structure entity ID → `resources`, `productionBuildings`, `troopsInReserve`
   - Compute free building slots → `freeSlots` (compare all valid direction paths vs. occupied coords)
6. **Process battle logs:**
   - Filter to player-involved battles (attacker/defender entity ID or owner ID matches owned entities)
   - Sort by timestamp desc, limit to 10 most recent
   - Parse event type (`ExplorerNewRaidEvent` → raid, else battle) → `recentBattles`
7. **Debug logging:** writes to `debug-world-state.log` with raw SQL data, ownership matches, parsed entities

**Helpers:**

- **Hex neighbors:** `hexNeighbors(x, y)` — even-r offset coordinates (matches Cairo contract), returns 6 neighbors with
  direction labels
- **Building slots:** `unpackBuildingCountsFromHex()` — unpack 3 u128 hex strings to 48 u8 counts, `computeFreeSlots()`
  — walk direction paths from center (10,10) to find unoccupied inner coords
- **Population:** `computePopulation()` — sum building pop costs, add WorkersHut capacity (6 per hut), base capacity 6
- **Felt252 decode:** `decodeFelt252(hex)` — convert felt252 hex to ASCII string (owner names)
- **Biome/occupier names:** `BIOME_NAMES`, `OCCUPIER_NAMES` — map enum values to labels
- **Guard strength:** `computeGuardStrength()` — sum `computeStrength(count, tier)` across 4 guard slots

**`formatEternumTickPrompt(state)`:**

Formats world state into a structured prompt for the agent:

1. **Header:** `## Tick {tick} - World State`
2. **You:** player name, rank, points, structure/army counts
3. **Resources (total):** aggregated across all structures, formatted with `fmtNum()` (1.5K, 2M, etc.)
4. **My Entities:**
   - **Structures:** entity line (type, ID, level, owner, pos, guard, actions), per-structure resources, production
     buildings, slots (used/total, free paths), population (current/capacity, warning if full), next upgrade, armies
     (current/max), guard slots, troop reserves, last attack/defense
   - **Armies:** entity line (ID, troops, strength, stamina, owner, pos, battle status, actions), neighbor tiles
     (deduplicated across armies), last attack/defense
5. **Nearby (other players):** structures and armies within VIEW_RADIUS
6. **Recent Battles:** last 10 player-involved battles (raid/battle, attacker/defender, winner, time ago)
7. **Leaderboard:** top 10 players
8. **Market:** recent swap count, open order count
9. **Actions:** instructions to use `execute_action`, `list_actions`, `observe_game`, update tasks/reflection

**Debug logging:** writes to `debug-tick-prompt.log` with full formatted prompt text.

### simulation.ts

**Dry-run action simulator** — uses pure compute functions for cost/outcome estimates.

**Supported actions:**

- **Combat:** `attack_explorer`, `attack_guard`, `guard_attack_explorer`, `raid` → `computeStrength(troops, tier)`,
  returns `{ estimatedStrength, cost: { troops } }`
- **Troops:** `create_explorer`, `add_guard` → `computeStrength()`, returns `{ strength, cost: { troops } }`
- **Bank:** `buy_resources`, `sell_resources` → `computeOutputAmount(amount, reserveIn, reserveOut, feeNum, feeDenom)`,
  returns `{ estimatedOutput, inputAmount, cost: { inputAmount } }`
- **Buildings:** `create_building` → `computeBuildingCost(baseCosts, existingCount, costPercentIncrease)`, returns
  `{ buildingCategory, cost: { resources } }`
- **Fallback:** returns `{ success: true, outcome: { message: "No simulation model for..." } }`

**Compute functions from `@bibliothecadao/client`:**

- `computeStrength(troops, tier)` — troop strength calculation (tier multiplier)
- `computeOutputAmount(...)` — AMM swap output (constant product formula with fees)
- `computeBuildingCost(baseCosts, existingCount, costPercentIncrease)` — building cost scaling (base + percent increase
  per existing building)

## TUI Components

### app.ts

**`createApp({ agent, ticker })`** — creates and starts the TUI for the agent.

**Layout:**

1. **Header:** `Text` component with tick count and agent state (Thinking/Idle)
2. **Chat:** `Container` with scrolling event log (agent messages, tool calls, errors)
3. **Input:** `Text` label (`> `) + buffer for user input

**Event handling:**

- **Agent events:** subscribes to `agent.subscribe(event => ...)`, appends to chat container:
  - `agent_start`, `agent_end` → status messages
  - `message_end` → renders assistant messages as `Markdown` components
  - `tool_execution_start` → logs `-> toolName(args)`
  - `tool_execution_end` → logs `v/x toolName done`
- **Keyboard input:** overrides `terminal.start(onData)` to capture user input:
  - **Enter:** sends buffered text to agent via `agent.prompt(msg)` or `agent.steer(msg)` (if streaming)
  - **Backspace:** removes last char from buffer
  - **Printable chars:** appends to buffer, updates input label

**Dependencies:** `@mariozechner/pi-tui` — TUI primitives (`ProcessTerminal`, `Container`, `Text`, `Markdown`)

**Lifecycle:** returns `{ tui, terminal, addSystemMessage, dispose() }`:

- `addSystemMessage(msg)` adds a `[System]`-prefixed text entry to the chat container and triggers a render
- `dispose()` unsubscribes from agent, stops TUI

All post-TUI messages in `index.ts` route through `addSystemMessage()` instead of `console.log` to avoid corrupting the
TUI's differential renderer.

### world-picker.ts

**`createWorldPicker(worlds: DiscoveredWorld[])`** — interactive TUI for selecting a game world.

**UI:**

- Uses `SelectList` from `@mariozechner/pi-tui` with custom theme (bold selected text, `> ` prefix)
- Items: `[{chain}] {name}  {status}` (padded for alignment)
- Keyboard: arrow keys to navigate, Enter to select, Esc or Ctrl+C to cancel

**Rendering:**

- Raw mode stdin capture (no line buffering)
- Erases previous render via ANSI escape codes (`\x1b[{lines}A\x1b[J`), writes new lines
- Hides cursor during interaction (`\x1b[?25l`), restores on exit (`\x1b[?25h`)

**Result:** returns `Promise<DiscoveredWorld | null>` — selected world or null if cancelled

## Tools & Inspection

### inspect-tools.ts

**Extra tools for detailed game state queries** — passed to `createGameAgent({ extraTools })`.

**Tools:**

1. **`inspect_realm(entityId)`** — detailed structure info:
   - Resource inventories with balances
   - Production rates (per tick, active/paused, time remaining)
   - Buildings (category, level, costs)
   - Guard slots (type, tier, count, strength)
   - Explorer summaries
   - Incoming arrivals, outgoing orders
   - Relics, battles, nearby entities
2. **`inspect_explorer(entityId)`** — army details:
   - Stamina (current, max)
   - Troop composition per slot (type, tier, count, total strength)
   - Carried resources
   - Battle status, battle reference
   - Nearby entities
   - Recent combat/movement events
3. **`inspect_market()`** — market state:
   - AMM pool balances/prices per resource
   - Recent swap history
   - Open trade orders (maker/taker, resources, amounts, expiry)
   - Player LP positions
4. **`inspect_bank(bankEntityId)`** — bank-specific state:
   - AMM pool balances/prices per resource at specific bank
   - Recent swap activity
   - Player LP positions

**Implementation:**

- Each tool calls `client.view.{realm|explorer|market|bank}()` from `EternumClient`
- Result serialized via `serializeView()` — truncates to 8000 chars if too large
- Logs to `debug-tool-responses.log` for debugging
- Returns `{ content: [{ type: "text", text }], details: { entityId?, found } }`

**Dependencies:** `AgentTool<any>` from `@mariozechner/pi-agent-core`

## Release & Packaging

### package-release.ts

CLI script for building release archives — invoked via `pnpm package:release`.

**Flags:**

- `--targets darwin-arm64,linux-x64` (default: all 4 targets)
- `--outDir /path/to/output` (default: `./release`)
- `--version 0.1.0` (default: read from package.json)
- `--skipBuild` (use pre-built binary)
- `--binaryPath /path/to/axis` (required if `--skipBuild`)
- `--licensePath /path/to/LICENSE` (default: `../../../LICENSE`)

**Output:**

- `axis-v{version}-{target}.tar.gz` per target
- `checksums.txt` with SHA256 hashes

**Process:**

1. Parse args, read version from package.json
2. Call `runReleasePackaging({ packageDir, outputDir, targets, version, skipBuild?, binaryPath?, licensePath? })`
3. Print archive paths + checksums path

### packager.ts

**`runReleasePackaging(options)`** — orchestrates multi-target packaging.

**Flow per target:**

1. **Build or reuse binary:**
   - If `skipBuild`: use `binaryPath`
   - Else: two-step build via `buildTargetBinary()`:
     - Step 1: `bun run build.ts` — bundles `src/cli.ts` to `dist-bun/cli.js` with build plugins (WASM embed + pi-config
       embed)
     - Step 2: `bun build dist-bun/cli.js --compile --target bun-{target} --outfile {temp}/{APP_NAME}-{target}` —
       compiles the bundle to a standalone binary
2. **Stage release layout:**
   - Create `{temp}/stage-{target}/axis/` directory
   - Copy binary → `axis` (chmod 755)
   - Copy common files: `package.json`, `README.md`, `.env.example`, `LICENSE`, `data/` (soul.md, HEARTBEAT.md,
     tasks/priorities.md)
3. **Validate layout:** check all `REQUIRED_STAGED_FILES` exist
4. **Create archive:** `tar -czf {outDir}/axis-v{version}-{target}.tar.gz -C {temp}/stage-{target} axis`
5. **Compute SHA256:** hash archive file, append to checksums array

**Output:**

- Archives written to `outputDir`
- `checksums.txt` with SHA256 hashes (one line per archive)
- Cleans up temp directory on completion

**Archive format:** `.tar.gz` containing single `axis/` directory with all files (binary at root, data/ subdir, docs at
root)

**Supported targets:** `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64` (Bun compile targets)

## Build Plugins

### build-plugins.ts

Two Bun build plugins that make the standalone binary fully self-contained.

**`wasmPlugin`** -- embeds `@cartridge/controller-wasm` WASM modules into the bundle.

Bun's bundler treats `.wasm` imports as file assets (path strings), which breaks the wasm-bindgen pattern. This plugin:

1. Intercepts wasm-bindgen entry JS files matching `controller-wasm/pkg-*/\w+_wasm.js`
2. Reads the sibling `.wasm` binary, encodes as base64
3. Generates replacement code that decodes bytes, instantiates `WebAssembly.Module`, and calls
   `__wbg_set_wasm(instance.exports)` with the glue JS as import object

**`createPiConfigPlugin(packageJsonPath)`** -- embeds `package.json` data into `pi-coding-agent`'s config.

The `@mariozechner/pi-coding-agent` config module reads `package.json` from disk relative to the module location, which
fails in a standalone binary. This plugin:

1. Reads `package.json` at build time
2. Intercepts `pi-coding-agent/dist/config.js`
3. Replaces the `readFileSync(getPackageJsonPath())` call with the static JSON literal

### build.ts

Two-step build script:

1. `Bun.build()` API bundles `src/cli.ts` to `dist-bun/cli.js` with both plugins
2. If `--compile` flag: `bun build dist-bun/cli.js --compile --outfile axis`

The resulting binary is fully standalone -- manifests (embedded via JSON imports), WASM modules (embedded via
wasmPlugin), and package.json (embedded via piConfigPlugin) are all inlined.

## Integration with @bibliothecadao Packages

### @bibliothecadao/game-agent

**Core agent framework** — tick loop, LLM driver, tool execution, state management.

**Key functions:**

- **`createGameAgent({ adapter, dataDir, model, tickIntervalMs, runtimeConfigManager?, extraTools?, actionDefs?, formatTickPrompt?, onTickError? })`**
  — returns `{ agent, ticker, dispose, enqueuePrompt, setDataDir }`
  - `onTickError` — optional callback invoked on tick errors; defaults to `console.error` but should route through the
    TUI's `addSystemMessage()` in the onchain-agent to keep output within the TUI
- **`createHeartbeatLoop({ getHeartbeatPath, onRun, onError })`** — cron-style scheduler for `HEARTBEAT.md` jobs,
  hot-reloads file on changes

**Agent lifecycle:**

1. **Tick:** `ticker.start()` → every `tickIntervalMs`:
   - Call `adapter.getWorldState()` → `EternumWorldState`
   - Format tick prompt via `formatTickPrompt(state)` → markdown
   - Enqueue prompt to agent message queue
2. **Agent loop:** dequeue prompt, stream LLM response, execute tool calls:
   - **`observe_game`** tool → calls `adapter.getWorldState()`, returns serialized state
   - **`execute_action`** tool → calls `adapter.executeAction(action)`, returns `ActionResult`
   - **`simulate_action`** tool → calls `adapter.simulateAction(action)`, returns `SimulationResult`
   - **`list_actions`** tool → returns `actionDefs` array
   - **Extra tools:** `inspect_realm`, `inspect_explorer`, `inspect_market`, `inspect_bank` (from
     `tools/inspect-tools.ts`)
   - **File tools:** `read_file`, `write_file` for soul.md, tasks/, HEARTBEAT.md
   - **Runtime config tools:** `get_agent_config`, `set_agent_config` for live config changes
3. **Dispose:** `ticker.stop()`, cleanup agent state

**Action definitions:** `getActionDefinitions()` from action registry → enriched tool descriptions with param schemas

### @bibliothecadao/client

**Headless game client** — SQL queries, view APIs, transaction building.

**Core API:**

- **`EternumClient.create({ rpcUrl, toriiUrl, worldAddress, manifest })`** — initializes SQL + view clients
- **`client.connect(account)`** — set signer for transactions
- **`client.sql.fetchAllStructuresMapData()`** — all structures with guard slots, buildings, owner
- **`client.sql.fetchAllArmiesMapData()`** — all armies with troop counts, stamina, owner
- **`client.sql.fetchAllTiles()`** — tile biome, occupier info
- **`client.sql.fetchBattleLogs()`** — recent battle events
- **`client.sql.fetchResourceBalancesAndProduction(entityIds)`** — per-structure resource balances, production building
  counts
- **`client.sql.fetchBuildingsByStructures(entityIds)`** — occupied building inner coords
- **`client.view.player(address)`** — player stats, structures, armies
- **`client.view.market()`** — AMM pools, recent swaps, open orders
- **`client.view.leaderboard({ limit })`** — top N players
- **`client.view.realm(entityId)`** — detailed structure info (resources, production, buildings, guards, arrivals,
  orders)
- **`client.view.explorer(entityId)`** — detailed army info (stamina, troops, resources, battle status)
- **`client.view.bank(bankEntityId)`** — bank AMM pools, LP positions

**Transaction APIs:**

- **`client.resources.send(signer, { senderEntityId, recipientEntityId, resources })`**
- **`client.resources.pickup(signer, { recipientEntityId, ownerEntityId, resources })`**
- **`client.resources.claimArrivals(signer, { structureId, day, slot, resourceCount })`**
- **`client.troops.createExplorer(signer, { forStructureId, category, tier, amount, spawnDirection })`**
- **`client.troops.addToExplorer(signer, { toExplorerId, amount, homeDirection })`**
- **`client.troops.move(signer, { explorerId, directions, explore })`**
- **`client.troops.travel(signer, { explorerId, directions })`**
- **`client.troops.explore(signer, { explorerId, directions })`**
- **`client.combat.attackExplorer(signer, { aggressorId, defenderId, defenderDirection, stealResources? })`**
- **`client.combat.attackGuard(signer, { explorerId, structureId, structureDirection })`**
- **`client.combat.raid(signer, { explorerId, structureId, structureDirection, stealResources })`**
- **`client.trade.createOrder(signer, { makerId, takerId, makerGivesResourceType, takerPaysResourceType, ... })`**
- **`client.trade.acceptOrder(signer, { takerId, tradeId, takerBuysCount })`**
- **`client.buildings.create(signer, { entityId, directions, buildingCategory, useSimple })`**
- **`client.buildings.destroy(signer, { entityId, buildingCoord })`**
- **`client.bank.buy(signer, { bankEntityId, entityId, resourceType, amount })`**
- **`client.bank.sell(signer, { bankEntityId, entityId, resourceType, amount })`**
- **`client.guild.create(signer, { isPublic, guildName })`**
- **`client.realm.upgrade(signer, { realmEntityId })`**
- **`client.hyperstructure.contribute(signer, { hyperstructureEntityId, contributorEntityId, contributions })`**

**Compute helpers:**

- **`computeStrength(troops, tier)`** — troop strength calculation
- **`computeOutputAmount(amount, reserveIn, reserveOut, feeNum, feeDenom)`** — AMM swap output
- **`computeBuildingCost(baseCosts, existingCount, costPercentIncrease)`** — building cost scaling

### @bibliothecadao/torii

**Torii SQL query helpers** — Factory resolution, SQL API utilities.

**Key exports:**

- **`FACTORY_QUERIES`** — pre-built SQL queries:
  - `WORLD_CONTRACTS_BY_PADDED_NAME(paddedName)` →
    `SELECT contract_address, contract_selector FROM [wf-WorldContractRegistered] WHERE ...`
  - `WORLD_DEPLOYED_BY_PADDED_NAME(paddedName)` → `SELECT * FROM [wf-WorldDeployed] WHERE ...`
- **`buildApiUrl(baseUrl, query)`** — encode query string
- **`fetchWithErrorHandling<T>(url, errorPrefix)`** — fetch + JSON parse + error handling
- **`RESOURCE_BALANCE_COLUMNS`** — array of `{ name, column }` for resource balances (e.g.
  `{ name: "Wood", column: "WOOD_BALANCE" }`)
- **`TROOP_BALANCE_COLUMNS`** — array of `{ name, column }` for troop reserves (e.g.
  `{ name: "KnightT1", column: "KNIGHT_T1_BALANCE" }`)

**SQL column conventions:**

- Balance: `{RESOURCE}_BALANCE` (hex u128, divide by RESOURCE_PRECISION)
- Production: `{RESOURCE}_PRODUCTION.building_count` (u8 count of active buildings)
- Guard slots: `{alpha|bravo|charlie|delta}_{count|category|tier}` (count is hex u128)

### @cartridge/controller

**Cartridge Controller session provider** — browser-based authentication.

**Key class:** `SessionProvider` from `@cartridge/controller/session/node`

**Constructor params:**

- `rpc`: RPC URL
- `chainId`: chain identifier
- `policies`: `{ contracts: Record<address, { methods: { name, entrypoint, description? }[] }>, messages?: [...] }`
- `basePath`: session storage directory

**Methods:**

- **`probe()`** — check for existing session on disk, return `WalletAccount | null`
- **`connect()`** — full auth flow (print URL, wait for callback), return `WalletAccount`
- **`disconnect()`** — clear session

**SessionAccount API:**

- **`executeFromOutside(calls)`** — paymaster-sponsored transaction (no gas)
- **`execute(calls)`** — direct execution (user pays gas)
- Implements StarkNet `AccountInterface` (compatible with `client.connect(account)`)

**WASM dependency:** `@cartridge/controller-wasm` (session signing, requires `--experimental-wasm-modules`)

### @mariozechner/pi-agent-core

**Autonomous agent core** — LLM driver, tool execution, agent state management.

**Key API:**

- **`Agent`** — main agent class:
  - **`prompt(text)`** — enqueue text prompt, stream LLM response
  - **`steer(message)`** — inject message mid-stream (for user steering)
  - **`subscribe(callback)`** — listen to agent events (agent_start, agent_end, message_end, tool_execution_start,
    tool_execution_end)
  - **`setModel(model)`** — hot-swap LLM model
  - **`state.isStreaming`** — true if agent is currently processing
- **`AgentTool<T>`** — tool interface:
  - `name`: tool name (snake_case)
  - `label`: human-readable label
  - `description`: tool description (what it does, when to use it)
  - `parameters`: JSON Schema object for params
  - `execute(toolCallId, args)`: async handler, returns `{ content: ContentBlock[], details?: any }`
- **`AgentEvent`** — event union:
  - `agent_start`, `agent_end` — agent lifecycle
  - `message_start`, `message_end` — LLM message boundaries
  - `tool_execution_start`, `tool_execution_end` — tool call lifecycle

**Model providers:** `@mariozechner/pi-ai` — `getModel(provider, modelId)` supports `anthropic`, `openai`, `openrouter`,
`google`, etc.

### @mariozechner/pi-tui

**Terminal UI primitives** — TUI components for building interactive CLI apps.

**Key classes:**

- **`ProcessTerminal`** — terminal abstraction (stdin/stdout, raw mode, cursor control)
- **`TUI`** — root container, layout engine, render loop
- **`Container`** — scrollable container (vertical stacking)
- **`Text`** — plain text component
- **`Markdown`** — markdown renderer (CommonMark)
- **`SelectList`** — interactive selection list (arrow keys, Enter, Esc)

**Lifecycle:**

1. Create components: `const text = new Text(); text.text = "...";`
2. Assemble layout: `tui.addChild(header); tui.addChild(chat); ...`
3. Subscribe to events: `agent.subscribe(event => { ... tui.requestRender(); })`
4. Start terminal: `terminal.start(onData, onResize)` — captures stdin, calls `onData(data)` per input
5. Render on change: `tui.requestRender()` — computes layout, writes ANSI escape codes
6. Stop: `tui.stop()` — restore terminal state, show cursor

**Styling:** components accept text with ANSI escape codes (`\x1b[1m` bold, `\x1b[0m` reset, etc.)

## Shutdown & Graceful Exit

### shutdown-gate.ts

**`createShutdownGate()`** — returns `{ promise, shutdown() }` for graceful shutdown coordination.

**Pattern:**

1. Create gate: `const gate = createShutdownGate();`
2. Register handlers: `process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);`
3. Cleanup: `shutdown()` calls `ticker.stop()`, `disposeAgent()`, `client.disconnect()`, `gate.shutdown()`
4. Await: `return gate.promise;` at end of `main()` — keeps process alive until shutdown

**Implementation:** gate holds a Promise resolve callback, `shutdown()` calls resolve once (idempotent).

## Configuration Reference

| Env Var              | Default                        | Description                                                                     |
| -------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `CHAIN`              | `slot`                         | Chain name (slot/slottest/local/sepolia/mainnet)                                |
| `RPC_URL`            | _(discovery)_                  | StarkNet RPC endpoint — if set (with TORII_URL, WORLD_ADDRESS), skips discovery |
| `TORII_URL`          | _(discovery)_                  | Torii SQL endpoint                                                              |
| `WORLD_ADDRESS`      | _(discovery)_                  | World contract address                                                          |
| `MANIFEST_PATH`      | _(none)_                       | Optional Dojo manifest JSON — only needed when bypassing world discovery        |
| `GAME_NAME`          | `eternum`                      | Game namespace (filters manifest tags for session policies)                     |
| `CHAIN_ID`           | _(auto-derived)_               | StarkNet chain ID (hex encoded short string)                                    |
| `SESSION_BASE_PATH`  | `~/.eternum-agent/.cartridge/` | Cartridge session storage directory                                             |
| `TICK_INTERVAL_MS`   | `60000`                        | Tick loop interval (1 min)                                                      |
| `LOOP_ENABLED`       | `true`                         | Auto-start tick loop on launch                                                  |
| `MODEL_PROVIDER`     | `anthropic`                    | LLM provider (anthropic/openai/openrouter/google)                               |
| `MODEL_ID`           | `claude-sonnet-4-5-20250929`   | LLM model ID                                                                    |
| `DATA_DIR`           | `~/.eternum-agent/data/`       | Data directory (soul.md, tasks/, HEARTBEAT.md)                                  |
| `ETERNUM_AGENT_HOME` | `~/.eternum-agent`             | Base directory for all paths                                                    |
| `ANTHROPIC_API_KEY`  | _(required)_                   | Anthropic API key (if MODEL_PROVIDER=anthropic)                                 |
| `OPENAI_API_KEY`     | _(required)_                   | OpenAI API key (if MODEL_PROVIDER=openai)                                       |
| `SLOT_NAME`          | _(optional)_                   | Auto-select world by name (skips TUI picker if matched)                         |
| `CARTRIDGE_API_BASE` | `https://api.cartridge.gg`     | Cartridge API base URL (overrides Factory/Torii endpoints)                      |

## Runtime Directories

```
~/.eternum-agent/
├── data/
│   ├── soul.md              # agent personality/instructions
│   ├── HEARTBEAT.md          # cron-style recurring jobs (version: 1, jobs: [...])
│   ├── tasks/
│   │   └── priorities.md     # task tracking markdown
│   ├── debug-world-state.log        # raw SQL ownership debug
│   ├── debug-tick-prompt.log        # formatted tick prompt text
│   ├── debug-actions.log            # action execution log (OK/FAIL)
│   ├── debug-actions-raw-errors.log # raw Starknet error dumps
│   └── debug-tool-responses.log     # inspect tool response text
├── .cartridge/
│   └── session.json          # Cartridge Controller session (auto-created on auth)
└── manifest.json             # patched manifest from world discovery (if used)
```

## Key Design Decisions

1. **Zero-config discovery:** eliminates manual RPC/Torii/WorldAddress config, queries Cartridge Factory SQL to find
   active worlds, auto-selects or presents TUI picker
2. **Browser-based auth:** Cartridge Controller sessions avoid storing private keys, use Passkeys/WebAuthn for secure
   signing
3. **Hot-swappable adapter:** `MutableGameAdapter` allows runtime config changes (RPC URL, model, tick interval) without
   restarting
4. **Action registry pattern:** 60+ action handlers in a single registry, LLM sees enriched tool descriptions with param
   schemas, human-readable suffixes (K/M/B/T), and reference strings
5. **View-radius filtering:** only show entities within 5 hexes of owned entities, reduces prompt size and focuses agent
   attention
6. **Structured tick prompt:** human-readable world state with per-structure resources, production buildings, free
   building paths, population, guard slots, neighbor tiles, battle history
7. **Heartbeat loop:** cron-style jobs from `HEARTBEAT.md` (hot-reloaded), allows periodic tasks like market checks or
   resource transfers
8. **TUI + input steering:** terminal UI with scrolling chat log, user can inject messages mid-stream to guide agent
   behavior
9. **Bun binary packaging:** single-file cross-platform binaries (darwin/linux x64/arm64), includes bundled data/ files
   and README/LICENSE
10. **Debug logging:** separate logs for world state, tick prompt, actions, raw errors, tool responses — enables
    post-mortem debugging without instrumenting agent loop

## Common Workflows

### First-time setup (zero config)

1. Install: `curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-axis.sh | bash`
2. Configure: `echo "ANTHROPIC_API_KEY=sk-ant-..." > ~/.eternum-agent/.env`
3. Run: `axis run`
4. World picker appears → select world with arrow keys, Enter
5. Browser opens with Cartridge auth URL → approve session with Passkeys
6. Agent starts tick loop, displays TUI

### Local dev setup

1. Clone repo: `git clone https://github.com/bibliothecadao/eternum.git`
2. Install deps: `pnpm install` (at repo root)
3. Build packages:
   `pnpm --dir packages/types build && pnpm --dir packages/torii build && pnpm --dir packages/provider build && pnpm --dir packages/client build && pnpm --dir packages/game-agent build`
4. Type-check: `pnpm --dir client/apps/onchain-agent build`
5. Configure: `cd client/apps/onchain-agent && cp .env.example .env` (edit with API key)
6. Run: `pnpm --dir client/apps/onchain-agent dev`

### Manual world config (skip discovery)

1. Edit `.env`:
   ```
   RPC_URL=http://localhost:5050
   TORII_URL=http://localhost:8080/sql
   WORLD_ADDRESS=0x...
   MANIFEST_PATH=/path/to/manifest.json   # optional
   ANTHROPIC_API_KEY=sk-ant-...
   ```
2. Run: `axis run` (no picker, connects directly)

### Live config changes (no restart)

Agent can reconfigure itself via `set_agent_config` tool:

```json
{
  "changes": [
    { "path": "tickIntervalMs", "value": 30000 },
    { "path": "model.id", "value": "claude-opus-4-6" },
    { "path": "loop.enabled", "value": false }
  ],
  "reason": "switching to opus for harder strategy"
}
```

### Build release archives

```bash
cd client/apps/onchain-agent
pnpm package:release
# outputs release/axis-v0.1.0-{target}.tar.gz + checksums.txt
```

### Add heartbeat job

Edit `~/.eternum-agent/data/HEARTBEAT.md`:

```yaml
version: 1
jobs:
  - id: market-check
    enabled: true
    schedule: "*/10 * * * *" # every 10 min
    mode: observe
    timeoutSec: 90
    prompt: |
      Check market conditions and summarize opportunities.
```

Changes apply immediately (hot-reloaded).

### Steer agent mid-tick

In TUI, type a message and press Enter:

```
> focus on building wheat farms, we need more food
```

Agent receives message and adjusts behavior.

## Testing & Debugging

### Validate config

```bash
axis doctor
# checks: WORLD_ADDRESS not 0x0, manifest exists, directories writable, API keys set
```

### Debug logs

All logs write to `~/.eternum-agent/data/debug-*.log`:

- **`debug-world-state.log`** — raw SQL ownership matches, parsed entities
- **`debug-tick-prompt.log`** — full formatted tick prompt text
- **`debug-actions.log`** — action execution log (OK tx={hash} or FAIL: {error})
- **`debug-actions-raw-errors.log`** — raw Starknet error dumps (message, baseError, data, stack)
- **`debug-tool-responses.log`** — inspect tool response text (realm/explorer/market/bank)

### Test action execution

Check `debug-actions.log` for recent action:

```
[2025-02-13T10:15:32.123Z] create_explorer({"forStructureId":123,...}) => OK tx=0x...
[2025-02-13T10:16:45.456Z] attack_explorer({...}) => FAIL: Insufficient stamina
```

### Test world state parsing

Check `debug-world-state.log` for ownership matches:

```
========== 2025-02-13T10:15:00.000Z ==========
accountAddress: 0x123...
ALL unique owner_addresses in structures:
  0x123...
  0x456...
Ownership matches (sameAddress with 0x123...):
  OWNED: entity_id=100 owner=0x123... coord=(50,60)
  OWNED: entity_id=101 owner=0x123... coord=(55,65)
ownedPositions: [{"x":50,"y":60},{"x":55,"y":65}]
final entities: 12 (2 structures, 10 armies)
```

### Inspect session policies

Session stored at `~/.eternum-agent/.cartridge/session.json` (JSON blob with public key, policies, expiration). Policies
include all Eternum system contracts + VRF + entry/fee tokens.

To force re-auth: `rm ~/.eternum-agent/.cartridge/session.json && axis run`

## Future Enhancements

- [ ] Multi-agent coordination — multiple agents sharing task queue
- [ ] Web-based TUI — expose TUI over WebSocket for remote monitoring
- [ ] GraphQL integration — replace SQL with Torii GraphQL queries (less brittle)
- [ ] Action batching — combine multiple actions into multicall (single tx)
- [ ] Predictive simulation — ML model for battle outcome prediction
- [ ] Resource optimization — linear programming for building/production scheduling
- [ ] Guild coordination — shared guild state, distributed decision-making
- [ ] Historical replay — load past game state from Torii, simulate agent behavior

## References

- **Eternum repo:** https://github.com/bibliothecadao/eternum
- **Cartridge Controller:** https://github.com/cartridge-gg/controller
- **StarkNet.js:** https://www.starknetjs.com/
- **Dojo Engine:** https://dojoengine.org/
- **Pi Agent Core:** https://github.com/mariozechner/pi (agent framework)
- **Pi TUI:** https://github.com/mariozechner/pi (terminal UI)

---

**Document version:** 2025-02-13 **Codebase version:** v0.1.0 **Author:** Claude Opus 4.6
