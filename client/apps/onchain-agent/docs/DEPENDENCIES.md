# Package Dependencies

This document describes the three core package dependencies used by the onchain-agent and how they work together to
provide game state access and blockchain interaction.

## Overview

The onchain-agent relies on three main packages from the `@bibliothecadao` workspace:

1. **`@bibliothecadao/torii`** - Torii indexer client and SQL query utilities
2. **`@bibliothecadao/eternum`** (core) - Game types, constants, and utility functions
3. **`@bibliothecadao/client`** - Headless client SDK for reading game state and submitting transactions

These packages form a layered architecture:

- **Torii** provides low-level data access (SQL queries, entity fetching)
- **Core** provides game logic, types, and calculations
- **Client** provides high-level abstractions over Torii + Core with caching and transaction helpers

---

## 1. @bibliothecadao/torii

**Purpose**: Torii indexer integration - provides SQL query utilities and typed responses for querying the Eternum game
database.

### Key Exports Used

#### SQL Query Utilities (`utils/sql.ts`)

```typescript
import {
  buildApiUrl, // Constructs full API URL with encoded query
  fetchWithErrorHandling, // Generic fetch wrapper with error handling
  RESOURCE_BALANCE_COLUMNS, // Column definitions for resource queries
  TROOP_BALANCE_COLUMNS, // Column definitions for troop queries
} from "@bibliothecadao/torii";
```

**How onchain-agent uses them**:

- `buildApiUrl` + `fetchWithErrorHandling` - Used in `factory-resolver.ts` to query factory deployment data
- `RESOURCE_BALANCE_COLUMNS` / `TROOP_BALANCE_COLUMNS` - Used in `world-state.ts` to parse resource and troop balances
  from SQL results

#### Factory Queries (`queries/sql/factory.ts`)

```typescript
import { FACTORY_QUERIES } from "@bibliothecadao/torii";

// Example usage:
const query = FACTORY_QUERIES.WORLD_CONTRACTS_BY_PADDED_NAME(paddedName);
const url = buildApiUrl(factorySqlBaseUrl, query);
const rows = await fetchWithErrorHandling<FactoryContractRow>(url, "Factory SQL failed");
```

### Data Flow

```
SQL Database (Torii Indexer)
    ↓
buildApiUrl() + fetchWithErrorHandling()
    ↓
Raw SQL response (arrays of typed rows)
    ↓
Parsed by onchain-agent adapters (world-state.ts)
    ↓
Enriched EternumEntity objects
```

### Key Types

Torii provides extensive type definitions for SQL responses in `types/sql.ts`:

- **Structure Data**: `StructureMapDataRaw`, `StructureDetails`, `PlayerStructure`
- **Army Data**: `ArmyMapDataRaw`, `ExplorerData`
- **Resource Data**: `ResourceBalanceRow`, `Resource`
- **Battle Data**: `BattleLogEvent`
- **Tile Data**: `Tile`, `ChestTile`, `QuestTileData`
- **Leaderboard**: `PlayerLeaderboardRow`, `RawPlayerLeaderboardRow`
- **Guard Data**: `GuardData`, `Guard`

### Configuration

The onchain-agent accesses Torii through the `EternumClient`, which is initialized with:

- `toriiUrl` - Base URL for Torii SQL API (e.g. `https://torii.eternum.realms.world`)
- `cacheUrl` - Optional cache layer URL

---

## 2. @bibliothecadao/client

**Purpose**: Headless Eternum client SDK - provides high-level, cached read queries and transaction helpers for
interacting with the game.

### Key Exports Used

#### EternumClient (Main Entry Point)

```typescript
import { EternumClient } from "@bibliothecadao/client";

// Create client instance
const client = await EternumClient.create({
  manifest,           // Dojo manifest (contract addresses, ABIs)
  rpcUrl,            // Starknet RPC endpoint
  toriiUrl,          // Torii indexer URL
  vrfProviderAddress, // VRF contract address
  cacheTtlMs: 30000, // Cache TTL in milliseconds
  cacheMaxSize: 1000 // Max cache entries
});

// Connect wallet for transactions
client.connect(account);

// Access view layer (read-only, cached queries)
await client.view.player(address);
await client.view.realm(entityId);
await client.view.market();

// Access transaction layer (write operations)
await client.resources.transfer(...);
await client.combat.attack(...);
await client.buildings.create(...);
```

#### Compute Functions

```typescript
import {
  computeStrength, // Calculate troop strength (count × tier multiplier)
  computeOutputAmount, // Calculate market output amount
  computeBuildingCost, // Calculate building construction cost
} from "@bibliothecadao/client";

// Example: Calculate army strength
const strength = computeStrength(troopCount, tier); // tier: 1-3
```

**How onchain-agent uses them**:

- `computeStrength` - Used in `world-state.ts` to calculate guard/army strength from raw troop data
- `computeOutputAmount` - Used in `simulation.ts` to simulate market trades
- `computeBuildingCost` - Used in `simulation.ts` to calculate building costs

### Architecture

The `EternumClient` is composed of three layers:

#### 1. View Layer (`client.view.*`)

Provides cached, read-only queries for game state:

```typescript
// View methods used by onchain-agent
client.view.player(address); // Player summary with structures/armies
client.view.market(); // Market swaps and orders
client.view.leaderboard({ limit }); // Leaderboard rankings
```

**Key features**:

- Built-in caching via `ViewCache` (TTL-based, configurable size)
- Graceful fallbacks on errors (returns empty/default data)
- Type-safe responses with well-defined view interfaces

#### 2. Transaction Layer (`client.resources.*`, `client.combat.*`, etc.)

Provides grouped transaction builders for write operations:

```typescript
// Transaction groups (not yet used by onchain-agent but available)
client.resources; // Resource transfers, minting
client.troops; // Troop creation, movement
client.combat; // Attack, raid, battle
client.trade; // Market swaps, orders
client.buildings; // Building placement, destruction
client.bank; // Bank deposits, withdrawals
client.hyperstructure; // Hyperstructure contributions
client.guild; // Guild management
client.realm; // Realm upgrades
```

#### 3. SQL Access (`client.sql.*`)

Direct access to the underlying Torii SQL API:

```typescript
// SQL methods used by onchain-agent (via world-state.ts)
client.sql.fetchAllStructuresMapData(); // All structures with map data
client.sql.fetchAllArmiesMapData(); // All armies with map data
client.sql.fetchAllTiles(); // All tile biome/occupier data
client.sql.fetchBattleLogs(); // Recent battle events
client.sql.fetchResourceBalancesAndProduction(entityIds); // Resource balances
client.sql.fetchBuildingsByStructures(entityIds); // Building positions
```

### Data Flow

```
onchain-agent calls client.view.* or client.sql.*
    ↓
ViewClient checks cache
    ↓ (cache miss)
Queries Torii SQL API via SqlApi
    ↓
Raw SQL response
    ↓
ViewClient transforms to typed view objects
    ↓
Stores in cache and returns
```

### Configuration

The client is configured via `EternumClientConfig`:

```typescript
interface EternumClientConfig {
  manifest: any; // Dojo manifest (contracts, ABIs)
  rpcUrl: string; // Starknet RPC URL
  toriiUrl: string; // Torii indexer URL
  cacheUrl?: string; // Optional cache layer URL
  vrfProviderAddress: string; // VRF contract address
  cacheTtlMs?: number; // Cache TTL (default: 30000ms)
  cacheMaxSize?: number; // Max cache entries (default: 1000)
  logger?: ClientLogger; // Custom logger (default: console)
}
```

---

## 3. @bibliothecadao/eternum (Core)

**Purpose**: Core game logic, types, constants, and utilities shared across all Eternum packages.

### Key Exports (Not Directly Imported)

While the onchain-agent doesn't directly import from `@bibliothecadao/eternum`, the package provides:

#### Game Constants & Configuration

- Resource types, building types, structure categories
- Game tick rates, production rates, upgrade costs
- Combat multipliers, stamina costs

#### Type Definitions (`@bibliothecadao/types`)

The core package re-exports types from `@bibliothecadao/types`:

```typescript
// Common types used throughout the ecosystem
type ID = number;
type ContractAddress = string;
type Position = { x: number; y: number };
type HexPosition = { col: number; row: number };

// Entity types
enum EntityType {
  STRUCTURE = 1,
  EXPLORER = 2,
  DONKEY = 3,
}

enum StructureType {
  REALM = 1,
  HYPERSTRUCTURE = 2,
  BANK = 3,
  FRAGMENT_MINE = 4,
  VILLAGE = 5,
}

// Resource types
interface ResourceAmount {
  resourceId: number;
  amount: number;
}

// Direction enum for hex navigation
enum Direction {
  EAST = 0,
  NORTH_EAST = 1,
  NORTH_WEST = 2,
  WEST = 3,
  SOUTH_WEST = 4,
  SOUTH_EAST = 5,
}
```

#### Utility Functions

- Hex coordinate math (distance, neighbors, pathfinding)
- Resource arrival calculations
- Biome generation algorithms

### Indirect Usage

The onchain-agent benefits from the core package indirectly through:

1. **Type safety** - Types defined in core are used by Torii and Client
2. **Consistency** - Constants ensure calculations match on-chain logic
3. **Utilities** - Compute functions in Client use core utilities under the hood

---

## Package Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     onchain-agent                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            world-state.ts (adapter)                   │   │
│  │  - Calls client.sql.fetch*()                         │   │
│  │  - Parses with RESOURCE_BALANCE_COLUMNS              │   │
│  │  - Enriches with computeStrength()                   │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────────┐   │
│  │           EternumClient (@client)                     │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │ ViewClient  │  │ TransactionClient │  │  cache  │  │   │
│  │  │ (read)      │  │ (write)       │  │  (TTL)   │  │   │
│  │  └──────┬──────┘  └──────────────┘  └────────────┘  │   │
│  │         │                                            │   │
│  │  ┌──────▼──────┐                                     │   │
│  │  │   SqlApi    │ ◄─── buildApiUrl, fetch*()         │   │
│  │  │  (@torii)   │                                     │   │
│  │  └──────┬──────┘                                     │   │
│  └─────────┼────────────────────────────────────────────┘   │
└────────────┼─────────────────────────────────────────────────┘
             │
             ▼
    ┌─────────────────┐
    │ Torii SQL API   │
    │ (PostgreSQL)    │
    └─────────────────┘
```

---

## Usage Patterns in onchain-agent

### 1. World State Construction

The primary use case is building a rich world state snapshot:

```typescript
// client/apps/onchain-agent/src/adapter/world-state.ts

export async function buildWorldState(
  client: EternumClient,
  accountAddress: string
): Promise<EternumWorldState> {
  // Fetch raw data from multiple sources in parallel
  const [
    playerView,
    marketView,
    leaderboardView,
    allRawStructures,
    allRawArmies,
    allTiles,
    allBattleLogs
  ] = await Promise.all([
    client.view.player(accountAddress),        // High-level view
    client.view.market(),                       // High-level view
    client.view.leaderboard({ limit: 10 }),    // High-level view
    client.sql.fetchAllStructuresMapData(),    // Raw SQL query
    client.sql.fetchAllArmiesMapData(),        // Raw SQL query
    client.sql.fetchAllTiles(),                // Raw SQL query
    client.sql.fetchBattleLogs()               // Raw SQL query
  ]);

  // Parse resources using Torii column definitions
  for (const col of RESOURCE_BALANCE_COLUMNS) {
    const hexVal = row[col.column];
    if (hexVal && hexVal !== "0x0") {
      const amount = Number(parseHexBig(hexVal) / BigInt(RESOURCE_PRECISION));
      if (amount > 0) {
        entityResources.set(col.name, amount);
      }
    }
  }

  // Calculate strength using Client compute function
  const strength = computeStrength(troopCount, tier);

  // Return enriched world state
  return { tick, timestamp, entities, resources, player, market, ... };
}
```

### 2. Factory Contract Resolution

Resolving world contracts from the factory deployment:

```typescript
// client/apps/onchain-agent/src/world/factory-resolver.ts

import { FACTORY_QUERIES, buildApiUrl, fetchWithErrorHandling } from "@bibliothecadao/torii";

export const resolveWorldContracts = async (
  factorySqlBaseUrl: string,
  worldName: string,
): Promise<Record<string, string>> => {
  const paddedName = nameToPaddedFelt(worldName);
  const query = FACTORY_QUERIES.WORLD_CONTRACTS_BY_PADDED_NAME(paddedName);
  const url = buildApiUrl(factorySqlBaseUrl, query);
  const rows = await fetchWithErrorHandling<FactoryContractRow>(url, "Factory SQL failed");

  const map: Record<string, string> = {};
  for (const row of rows) {
    const key = normalizeSelector(row.contract_selector);
    map[key] = row.contract_address;
  }
  return map;
};
```

### 3. Simulation & Calculations

Using compute functions for action simulation:

```typescript
// client/apps/onchain-agent/src/adapter/simulation.ts

import { computeStrength, computeOutputAmount, computeBuildingCost } from "@bibliothecadao/client";

// Simulate a market swap
export function simulateSwap(inputAmount: number, poolState: PoolState) {
  const outputAmount = computeOutputAmount(
    inputAmount,
    poolState.reserve1,
    poolState.reserve2
  );
  return { outputAmount, priceImpact: ... };
}

// Calculate building cost
export function getBuildingCost(buildingType: number) {
  return computeBuildingCost(buildingType);
}
```

---

## Dependency Version Management

All three packages are part of the same monorepo workspace and use `workspace:*` protocol:

```json
// client/apps/onchain-agent/package.json
{
  "dependencies": {
    "@bibliothecadao/client": "workspace:*",
    "@bibliothecadao/torii": "workspace:*",
    "@bibliothecadao/types": "workspace:*"
  }
}
```

This ensures:

- Always using the latest local versions during development
- Consistent versioning across the monorepo
- Simplified dependency updates (single `pnpm install` at root)

---

## Common Patterns

### Pattern 1: Parallel Data Fetching

Fetch multiple independent data sources in parallel to minimize latency:

```typescript
const [structures, armies, tiles] = await Promise.all([
  client.sql.fetchAllStructuresMapData(),
  client.sql.fetchAllArmiesMapData(),
  client.sql.fetchAllTiles(),
]);
```

### Pattern 2: View + SQL Hybrid

Use high-level views for simple queries, SQL for complex/bulk queries:

```typescript
// Simple, cached query - use view
const playerData = await client.view.player(address);

// Complex bulk query - use SQL directly
const allStructures = await client.sql.fetchAllStructuresMapData();
```

### Pattern 3: Parse-Enrich-Transform

Transform raw SQL data into agent-friendly structures:

```typescript
// 1. Parse hex values from SQL
const count = Number(parseHexBig(raw.count) / BigInt(RESOURCE_PRECISION));

// 2. Enrich with computed values
const strength = computeStrength(count, tier);

// 3. Transform to domain model
return {
  entityId: raw.entity_id,
  strength,
  troopSummary: `${count} ${category} T${tier}`,
};
```

---

## Performance Considerations

### Caching Strategy

The `EternumClient` uses a TTL-based cache to reduce redundant queries:

- **Default TTL**: 30 seconds (configurable via `cacheTtlMs`)
- **Default max size**: 1000 entries (configurable via `cacheMaxSize`)
- **Cache keys**: Derived from method name + parameters (e.g., `player:0x123abc`)

**When to bypass cache**:

- Real-time transaction confirmations (use `client.sql.*` directly)
- High-frequency updates (tick-based state changes)

### Batch Queries

For multiple entities, prefer batch queries over sequential fetches:

```typescript
// ❌ Bad: N sequential queries
for (const id of entityIds) {
  await client.sql.fetchResourceBalances([id]);
}

// ✅ Good: Single batch query
await client.sql.fetchResourceBalances(entityIds);
```

### SQL Query Optimization

- Use specific column selections instead of `SELECT *`
- Filter at the SQL level when possible (WHERE clauses)
- Limit result sets with LIMIT/OFFSET for pagination

---

## Error Handling

All three packages follow consistent error handling patterns:

### Torii (`fetchWithErrorHandling`)

```typescript
try {
  const result = await fetchWithErrorHandling<T>(url, "Query failed");
  return result; // Always an array
} catch (error) {
  // Throws descriptive error with status text
  throw new Error(`Query failed: ${response.statusText}`);
}
```

### Client (ViewClient)

```typescript
try {
  const data = await this.sql.fetchPlayerStructures(owner);
  // ... transform data ...
  return view;
} catch (error) {
  this.logger.warn(`View query failed; returning fallback`, { error });
  return fallbackView; // Never throws - graceful degradation
}
```

**Onchain-agent strategy**:

- Let Torii errors propagate for factory queries (critical)
- Rely on Client fallbacks for view queries (graceful)
- Wrap high-level operations in try-catch for logging

---

## Future Enhancements

Potential improvements to the dependency layer:

1. **Streaming Updates**: Subscribe to real-time entity changes via WebSocket
2. **Offline Support**: Cache world state snapshots for offline analysis
3. **Query Builder**: Type-safe SQL query builder for custom queries
4. **Transaction Batching**: Batch multiple transactions into a single call
5. **Optimistic Updates**: Update cache before transaction confirmation

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall onchain-agent architecture
- [GAME_AGENT.md](./GAME_AGENT.md) - Core AI agent framework
- [Torii Package README](../../../packages/torii/README.md) - Torii package documentation
- [Client Package README](../../../packages/client/README.md) - Client package documentation

---

## Summary

The onchain-agent leverages three tightly integrated packages:

- **Torii** provides low-level SQL query access and type definitions
- **Client** provides high-level cached views and transaction builders
- **Core** (indirectly) provides shared types, constants, and utilities

Together, they enable the onchain-agent to:

1. Efficiently query game state from the Torii indexer
2. Build rich, agent-friendly world state representations
3. Simulate game actions using compute functions
4. Submit transactions to the blockchain (future)

The layered architecture ensures separation of concerns while maintaining type safety and performance through caching
and batch queries.
