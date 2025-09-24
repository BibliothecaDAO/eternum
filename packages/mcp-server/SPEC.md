# MCP Server Specification

## Purpose & Scope
- Expose Eternum's live world state and transactional capabilities to AI agents via MCP.
- Reuse existing Torii SQL queries, gRPC subscriptions, provider transaction layer, and shared type definitions.
- Out of scope: UI wiring, direct LLM prompt design, secrets UX, or production infra provisioning.

## Key Dependencies
- Runtime: `@modelcontextprotocol/sdk`, `@bibliothecadao/torii`, `@bibliothecadao/provider`, `@bibliothecadao/types`, `zod`, preferred logger (e.g., `pino` or existing telemetry), optional caching helpers (`lru-cache`, `dataloader`).
- Build/tooling: `tsup`, `typescript` (extending `packages/tsconfig.base.json`), `vitest`.
- External inputs: Torii SQL base URL, Torii gRPC endpoint, Starknet RPC, Dojo manifest path, signing key for transactional tools.

## Package Layout
```
packages/mcp-server/
├── package.json
├── tsconfig.json
├── README.md
├── SPEC.md
├── src/
│   ├── server.ts
│   ├── config.ts
│   ├── context.ts
│   ├── types.ts
│   ├── utils/
│   │   └── logger.ts
│   ├── adapters/
│   │   ├── torii-adapter.ts
│   │   └── provider-adapter.ts
│   ├── resources/
│   │   ├── index.ts
│   │   ├── realms.ts
│   │   ├── armies.ts
│   │   ├── tiles.ts
│   │   ├── market.ts
│   │   ├── players.ts
│   │   └── battles.ts
│   └── tools/
│       ├── index.ts
│       ├── trading.ts
│       ├── movement.ts
│       ├── structures.ts
│       └── combat.ts
└── tests/
    ├── torii-adapter.test.ts
    ├── provider-adapter.test.ts
    ├── resources.test.ts
    └── tools.test.ts
```

## Runtime Architecture
- `ServerContext` lazily constructs shared clients (Torii SQL, Torii gRPC, provider, caches) and exposes lifecycle hooks.
- Resource registry files call `registerResource` with metadata, completions, and caching policy (TTL + subscription invalidation).
- Tool registry files call `registerTool`, leveraging provider adapter for Starknet transactions and returning MCP-compliant responses.
- Notification debouncing enabled for tools/resources/prompts list updates to minimize chatter.

## Resources
Each resource returns JSON payloads (`mimeType: application/json`) representing agent-friendly DTOs defined in `types.ts`.

### `eternum://realms/{realmId}`
- Data: realm metadata, owner, wonders, resources, population, connected settlements, garrisons, relics.
- Sources: `SqlApi.fetchStructureByCoord`, `SqlApi.fetchPlayerStructures`, `SqlApi.fetchGuardsByStructure`, resource unpacking utilities from core package.
- Caching: TTL ~5s with invalidation on Torii entity updates. Provide completions based on realm names/IDs.

### `eternum://armies/{entityId}`
- Data: explorer troops, stamina, carried resources, coordinates, active orders, relics.
- Sources: `SqlApi.fetchAllArmiesMapData`, `SqlApi.fetchPlayerArmyRelics`, Torii gRPC subscription.
- Caching: TTL ~2s plus push updates.

### `eternum://tiles/{x},{y}` and `eternum://tiles/nearby/{x},{y}`
- Data: biome, occupants, fog state, production boosts, nearby chests.
- Sources: `SqlApi.fetchTilesByCoords`, structure/army map data aggregations, chest queries for completions.

### `eternum://market/orders`
- Data: active trade orders, pricing, liquidity summaries, pagination via query params.
- Sources: `SqlApi` trading queries, `MarketManager` helpers for price/slippage calculations.

### `eternum://players/{address}`
- Data: player stats, structures, armies, guild membership, relic holdings.
- Sources: `SqlApi.fetchPlayerStructures`, `SqlApi.fetchAllPlayerRelics`, structure/explorer summary query.

### `eternum://battles/logs`
- Data: chronological combat log with participants, outcome, rewards, casualties; filterable by timestamp.
- Sources: `SqlApi.fetchBattleLogs`, optional Torii subscription for live updates.

## Tools
Handlers validate inputs with `zod`, perform optimistic checks via core managers, invoke provider adapter, and surface MCP responses (`content`, `resource_link`) with normalized error codes.

### `create_trade_order`
- Schema: maker/taker IDs, offered/requested resources, expiration.
- Execution: provider `create_order`; optional preflight pricing via `MarketManager`.
- Response: acknowledgement + resource link to specific trade in market resource.

### `move_army`
- Schema: explorer ID, direction path, explore flag.
- Execution: provider `explorer_move`; stamina check via `ArmyManager`.

### `upgrade_structure`
- Schema: structure ID and optional category confirmation.
- Execution: provider `upgrade_realm` or relevant entrypoint; uses `StructureActionManager` for cost validation.

### `explore_tile`
- Schema: explorer ID, target direction/coord.
- Execution: `explorer_move` with explore flag, optional VRF call; streams reveal updates.

### `join_battle`
- Schema: battle ID, participant ID, role, optional steal resources.
- Execution: choose appropriate provider call (`attack_explorer_vs_guard`, etc.), ensure adjacency requirements.

## Configuration & Secrets
- Environment-driven config validated by `config.ts` (`TORII_SQL_URL`, `TORII_GRPC_URL`, `STARKNET_RPC_URL`, `DOJO_MANIFEST_PATH`, `ACCOUNT_PRIVATE_KEY`, optional cache TTLs, `LOG_LEVEL`).
- Support custom account providers by allowing injection via context factory.
- Mask sensitive values in logs.

## Transport Modes
- Default stdio transport for CLI/agent integration.
- Optional Streamable HTTP mode when `MCP_HTTP_PORT` set; minimal Express bootstrap with session management and DNS rebinding protection options.

## Error Handling & Logging
- Centralized logger that tags events with request IDs.
- Resource/tool handlers wrap operations in try/catch; on failure log structured error and return `isError` with `errorId`.
- Provider adapter maps common Starknet failures to semantic error codes (`INSUFFICIENT_FUNDS`, `INVALID_TARGET`, etc.).

## Testing Strategy
- Vitest unit tests for adapters (mock fetch/provider), resources (schema/caching), tools (calldata and response). Use fixtures for deterministic SQL responses.
- Optional integration harness against local Torii when available.

## Workspace Integration
- Add package to `pnpm-workspace.yaml`; reuse repo lint/format tooling.
- Document usage in new README with setup commands and sample MCP client calls.
- Future: integrate with `client/apps/bot` to replace static docs with live MCP queries.

## Delivery Milestones
1. Scaffold package with config/context skeletons and single realm resource (read-only).
2. Implement remaining resources, caching, and telemetry.
3. Add transactional tools and error normalization.
4. Expose HTTP transport and subscription handling.
5. Harden via tests/documentation, then integrate with bot agents.

## Open Questions
- Preferred secret sourcing for signer credentials (local key vs cloud vault).
- Acceptable data staleness thresholds per resource and Torii query rate limits.
- Need for bundled prompts or higher-level agent workflows.
- Expected response format nuances for downstream consumers (pure JSON vs mixed markdown).
