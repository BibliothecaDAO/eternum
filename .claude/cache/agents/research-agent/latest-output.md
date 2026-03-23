# Research Report: Apibara (DNA v2) AMM Indexer + TypeScript SDK for Eternum

Generated: 2026-03-23

## Executive Summary

Apibara provides a mature TypeScript-first indexing framework for Starknet with built-in PostgreSQL persistence via
Drizzle ORM, automatic chain reorg handling, and type-safe event decoding. Eternum currently uses Torii (Dojo's built-in
indexer) for all on-chain data -- there is zero existing Apibara usage in the codebase. The recommended approach is a
standalone Apibara indexer service with Drizzle/PostgreSQL storage, plus a `@bibliothecadao/amm-sdk` package following
the existing `@bibliothecadao/client` patterns (transaction classes + SQL API queries).

## Research Question

How to build an Apibara DNA v2 indexer for the Eternum AMM contract events, and a companion TypeScript SDK package for
read/write AMM interactions.

---

## Key Findings

### Finding 1: Apibara Architecture and Current State

Apibara is a TypeScript-first framework for building production-grade blockchain indexers. The current version uses the
`@apibara/indexer`, `@apibara/starknet`, and `@apibara/plugin-drizzle` packages.

**Core concepts:**

- **DNA Stream**: A gRPC-based streaming protocol that delivers filtered blockchain data in real-time
- **Indexer**: A `defineIndexer(StarknetStream)` function that configures filters, transform logic, and storage plugins
- **Transform function**: Receives each block's filtered data and processes it (insert/update/delete in DB)
- **Factory function**: Dynamically adds filters at runtime (useful for contracts that deploy other contracts --
  relevant for our LP token deployments)
- **Plugins**: Storage backends (Drizzle/PostgreSQL), logging, etc.

**Stream URLs:**

- Mainnet: `https://mainnet.starknet.a5a.ch`
- Sepolia: `https://sepolia.starknet.a5a.ch`
- Authentication: `DNA_TOKEN` environment variable

**Key packages:**

```
@apibara/indexer        - Core indexer framework
@apibara/starknet       - Starknet stream, filters, helpers, event decoder
@apibara/plugin-drizzle - Drizzle ORM PostgreSQL persistence
apibara                 - CLI tool (apibara dev, apibara build, apibara start)
```

- Source: [Apibara Documentation - Indexers](https://www.apibara.com/docs/getting-started/indexers)
- Source: [Apibara Documentation - Installation](https://www.apibara.com/docs/getting-started/installation)

### Finding 2: Event Filtering and Decoding

Apibara provides precise event filtering by contract address and event selector:

```typescript
import { StarknetStream, getSelector, decodeEvent } from "@apibara/starknet";
import { defineIndexer } from "@apibara/indexer";

const AMM_ADDRESS = "0x..."; // AMM contract address

const filter = {
  events: [
    { address: AMM_ADDRESS, keys: [getSelector("PoolCreated")] },
    { address: AMM_ADDRESS, keys: [getSelector("LiquidityAdded")] },
    { address: AMM_ADDRESS, keys: [getSelector("LiquidityRemoved")] },
    { address: AMM_ADDRESS, keys: [getSelector("Swap")] },
    { address: AMM_ADDRESS, keys: [getSelector("PoolFeeChanged")] },
    { address: AMM_ADDRESS, keys: [getSelector("FeeRecipientChanged")] },
  ],
};
```

**Event decoding** uses ABI definitions with `as const satisfies Abi` for type safety:

```typescript
import type { Abi } from "@apibara/starknet";

const ammAbi = [
  {
    kind: "enum",
    name: "eternum_amm::amm::EternumAMM::Event",
    type: "event",
    variants: [
      { kind: "nested", name: "PoolCreated", type: "eternum_amm::amm::EternumAMM::PoolCreated" },
      { kind: "nested", name: "Swap", type: "eternum_amm::amm::EternumAMM::Swap" },
      // ... other variants
    ],
  },
  // ... struct definitions for each event
] as const satisfies Abi;

// In transform:
const decoded = decodeEvent({
  abi: ammAbi,
  event,
  eventName: "eternum_amm::amm::EternumAMM::Event",
  strict: false,
});

switch (decoded.args._tag) {
  case "Swap":
    // decoded.args.Swap.user, .token_in, .token_out, etc.
    break;
  case "PoolCreated":
    // decoded.args.PoolCreated.token, .lp_token, etc.
    break;
}
```

**Filter options include:**

- `includeTransaction: true` -- attach the emitting transaction
- `includeReceipt: true` -- include receipt for gas data
- `strict: true` -- exact key match (vs prefix matching)

- Source: [Apibara - Starknet Filter Reference](https://www.apibara.com/docs/networks/starknet/filter)
- Source: [Apibara - Starknet Event Decoder](https://www.apibara.com/docs/networks/starknet/decoder)
- Source: [Apibara - Starknet Helpers](https://www.apibara.com/docs/networks/starknet/helpers)

### Finding 3: PostgreSQL Storage with Drizzle

Apibara's Drizzle plugin provides:

- Automatic chain reorg protection via audit tables
- State persistence in `airfoil.checkpoints` and `airfoil.filters` tables
- Transaction wrapping for all transform/factory operations
- Automatic migrations support

```typescript
import { drizzle, drizzleStorage, useDrizzleStorage } from "@apibara/plugin-drizzle";

const db = drizzle({ schema });

export default defineIndexer(StarknetStream)({
  plugins: [drizzleStorage({ db, migrate: { migrationsFolder: "./migrations" } })],
  async transform({ block }) {
    const { db } = useDrizzleStorage();
    // db.insert(...), db.update(...), etc.
  },
});
```

**Environment:** Reads `POSTGRES_CONNECTION_STRING` env var. Supports in-memory PGLite for dev/testing.

**Important constraint:** Every table must have a unique `id` column (name configurable via `idColumn` option).

- Source: [Apibara - Drizzle with PostgreSQL](https://www.apibara.com/docs/storage/drizzle-pg)

### Finding 4: Eternum's Current Indexing Infrastructure

**Eternum uses Torii exclusively** -- there is zero Apibara usage in the codebase. Key findings:

1. **Torii indexer** is used for all on-chain data. It runs via shell scripts (`contracts/game/ext/scripts/indexer.sh`)
   that start `torii` with a TOML config file.

2. **SQL API pattern**: The `@bibliothecadao/torii` package queries Torii's built-in SQL endpoint. Queries are raw SQL
   strings against Torii's internal tables (e.g., `` `s1_eternum-SwapEvent` ``). There is already a `SwapEvent` type and
   `fetchSwapEvents()` method in the existing codebase for the in-game AMM.

3. **Existing SwapEvent** (in `packages/torii/src/queries/sql/trading.ts`):

```sql
SELECT se.entity_id, se.resource_type, se.lords_amount, se.resource_amount,
       se.resource_price, se.buy, se.timestamp, s.owner
FROM `s1_eternum-SwapEvent` se
LEFT JOIN `s1_eternum-Structure` s ON se.entity_id = s.entity_id
ORDER BY se.timestamp DESC;
```

4. **Client architecture** (`packages/client/`): Uses `EternumClient` class with:
   - `ViewClient` for read queries (SQL-backed)
   - Transaction classes (`TradeTransactions`, `BankTransactions`, etc.) for write operations
   - `ViewCache` for client-side caching
   - Dynamic imports of `@bibliothecadao/provider` and `@bibliothecadao/torii`

5. **Provider pattern** (`packages/provider/`): Uses starknet.js `Account`/`AccountInterface` with a
   `TransactionExecutor` interface.

6. **Package structure**: All packages use `tsup` for builds, `vitest` for tests, ES modules, and workspace references
   via `workspace:*`.

### Finding 5: Ekubo Protocol Indexer (Reference Architecture)

The Ekubo Protocol indexer is a production Starknet AMM indexer using Apibara + PostgreSQL:

- **Philosophy**: Events are catalogued raw, not transformed. Materialized views and analytical queries handle derived
  data.
- **Stack**: Bun runtime, TypeScript, PostgreSQL, Apibara DNA
- **Reorg handling**: `indexer_cursor` table with `fork_counter` column
- **Multi-network**: Same codebase indexes Starknet mainnet, sepolia, and EVM chains via environment config
- **Supplementary jobs**: Scheduled scripts for `sync-tokens.ts` and `sync-token-prices.ts`
- **Bootstrap**: Uses nightly DB backup dumps rather than syncing from genesis

- Source: [EkuboProtocol/indexer on GitHub](https://github.com/EkuboProtocol/indexer)

---

## AMM Indexer Design

### Recommended Architecture

```
contracts/amm/indexer/
  apibara.config.ts              # Apibara configuration
  package.json
  tsconfig.json
  indexers/
    amm.indexer.ts               # Main indexer definition
  src/
    abi.ts                       # ABI constants for event decoding
    schema.ts                    # Drizzle schema (all tables)
  migrations/                    # Drizzle migration files
  scripts/
    generate-candles.ts          # Periodic candle aggregation
    sync-reserves.ts             # Periodic reserve snapshot from RPC
```

### Database Schema (Drizzle ORM)

```typescript
// src/schema.ts
import {
  pgTable,
  uuid,
  text,
  bigint,
  integer,
  timestamp,
  numeric,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// -- Core tables --

export const pools = pgTable(
  "pools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenAddress: text("token_address").notNull(),
    lpTokenAddress: text("lp_token_address").notNull(),
    lordsReserve: numeric("lords_reserve", { precision: 78, scale: 0 }).notNull().default("0"),
    tokenReserve: numeric("token_reserve", { precision: 78, scale: 0 }).notNull().default("0"),
    totalLpSupply: numeric("total_lp_supply", { precision: 78, scale: 0 }).notNull().default("0"),
    lpFeeNum: numeric("lp_fee_num", { precision: 78, scale: 0 }).notNull(),
    lpFeeDenom: numeric("lp_fee_denom", { precision: 78, scale: 0 }).notNull(),
    protocolFeeNum: numeric("protocol_fee_num", { precision: 78, scale: 0 }).notNull(),
    protocolFeeDenom: numeric("protocol_fee_denom", { precision: 78, scale: 0 }).notNull(),
    createdAt: timestamp("created_at").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    txHash: text("tx_hash").notNull(),
  },
  (t) => [uniqueIndex("pools_token_address_idx").on(t.tokenAddress)],
);

export const swaps = pgTable(
  "swaps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenAddress: text("token_address").notNull(), // the pool's token (not lords)
    userAddress: text("user_address").notNull(),
    tokenIn: text("token_in").notNull(),
    tokenOut: text("token_out").notNull(),
    amountIn: numeric("amount_in", { precision: 78, scale: 0 }).notNull(),
    amountOut: numeric("amount_out", { precision: 78, scale: 0 }).notNull(),
    protocolFee: numeric("protocol_fee", { precision: 78, scale: 0 }).notNull(),
    // Derived at index time from reserves before the swap
    priceBeforeSwap: numeric("price_before_swap", { precision: 40, scale: 18 }),
    priceAfterSwap: numeric("price_after_swap", { precision: 40, scale: 18 }),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
    txHash: text("tx_hash").notNull(),
    eventIndex: integer("event_index").notNull(),
  },
  (t) => [
    index("swaps_token_address_idx").on(t.tokenAddress),
    index("swaps_user_address_idx").on(t.userAddress),
    index("swaps_block_timestamp_idx").on(t.blockTimestamp),
  ],
);

export const liquidityEvents = pgTable(
  "liquidity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenAddress: text("token_address").notNull(),
    providerAddress: text("provider_address").notNull(),
    eventType: text("event_type").notNull(), // "add" | "remove"
    lordsAmount: numeric("lords_amount", { precision: 78, scale: 0 }).notNull(),
    tokenAmount: numeric("token_amount", { precision: 78, scale: 0 }).notNull(),
    lpAmount: numeric("lp_amount", { precision: 78, scale: 0 }).notNull(), // minted or burned
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
    txHash: text("tx_hash").notNull(),
    eventIndex: integer("event_index").notNull(),
  },
  (t) => [
    index("liq_token_address_idx").on(t.tokenAddress),
    index("liq_provider_address_idx").on(t.providerAddress),
    index("liq_block_timestamp_idx").on(t.blockTimestamp),
  ],
);

export const poolFeeChanges = pgTable("pool_fee_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenAddress: text("token_address").notNull(),
  lpFeeNum: numeric("lp_fee_num", { precision: 78, scale: 0 }).notNull(),
  lpFeeDenom: numeric("lp_fee_denom", { precision: 78, scale: 0 }).notNull(),
  protocolFeeNum: numeric("protocol_fee_num", { precision: 78, scale: 0 }).notNull(),
  protocolFeeDenom: numeric("protocol_fee_denom", { precision: 78, scale: 0 }).notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  blockTimestamp: timestamp("block_timestamp").notNull(),
  txHash: text("tx_hash").notNull(),
});

// -- Derived / aggregation tables --

export const priceCandles = pgTable(
  "price_candles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenAddress: text("token_address").notNull(),
    interval: text("interval").notNull(), // "1m", "5m", "15m", "1h", "4h", "1d"
    openTime: timestamp("open_time").notNull(),
    closeTime: timestamp("close_time").notNull(),
    open: numeric("open", { precision: 40, scale: 18 }).notNull(),
    high: numeric("high", { precision: 40, scale: 18 }).notNull(),
    low: numeric("low", { precision: 40, scale: 18 }).notNull(),
    close: numeric("close", { precision: 40, scale: 18 }).notNull(),
    volume: numeric("volume", { precision: 78, scale: 0 }).notNull(), // in lords
    tradeCount: integer("trade_count").notNull(),
  },
  (t) => [uniqueIndex("candles_token_interval_time_idx").on(t.tokenAddress, t.interval, t.openTime)],
);

export const poolSnapshots = pgTable(
  "pool_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenAddress: text("token_address").notNull(),
    lordsReserve: numeric("lords_reserve", { precision: 78, scale: 0 }).notNull(),
    tokenReserve: numeric("token_reserve", { precision: 78, scale: 0 }).notNull(),
    totalLpSupply: numeric("total_lp_supply", { precision: 78, scale: 0 }).notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
  },
  (t) => [index("snapshots_token_time_idx").on(t.tokenAddress, t.blockTimestamp)],
);
```

### Indexer Implementation Pattern

```typescript
// indexers/amm.indexer.ts
import { defineIndexer } from "apibara/indexer";
import { StarknetStream, getSelector, decodeEvent } from "@apibara/starknet";
import { drizzleStorage, useDrizzleStorage, drizzle } from "@apibara/plugin-drizzle";
import type { ApibaraRuntimeConfig } from "apibara/types";
import * as schema from "../src/schema";
import { ammAbi } from "../src/abi";

export default function (runtimeConfig: ApibaraRuntimeConfig) {
  const { ammAddress, streamUrl, startingBlock } = runtimeConfig.amm;
  const db = drizzle({ schema });

  return defineIndexer(StarknetStream)({
    streamUrl,
    finality: "accepted",
    startingCursor: { orderKey: BigInt(startingBlock) },
    filter: {
      header: "on_data",
      events: [
        { address: ammAddress, keys: [getSelector("PoolCreated")], includeTransaction: true },
        { address: ammAddress, keys: [getSelector("LiquidityAdded")], includeTransaction: true },
        { address: ammAddress, keys: [getSelector("LiquidityRemoved")], includeTransaction: true },
        { address: ammAddress, keys: [getSelector("Swap")], includeTransaction: true },
        { address: ammAddress, keys: [getSelector("PoolFeeChanged")], includeTransaction: true },
        { address: ammAddress, keys: [getSelector("FeeRecipientChanged")], includeTransaction: true },
      ],
    },
    plugins: [drizzleStorage({ db, migrate: { migrationsFolder: "./migrations" } })],
    async transform({ block, endCursor }) {
      const { db } = useDrizzleStorage();
      const { events, header } = block;
      const blockNumber = endCursor.orderKey;
      const blockTimestamp = new Date(Number(header?.timestamp ?? 0) * 1000);

      for (const event of events) {
        const decoded = decodeEvent({
          abi: ammAbi,
          event,
          eventName: "eternum_amm::amm::EternumAMM::Event",
          strict: false,
        });
        if (!decoded) continue;

        switch (decoded.args._tag) {
          case "Swap":
            await handleSwap(db, decoded, blockNumber, blockTimestamp, event);
            break;
          case "PoolCreated":
            await handlePoolCreated(db, decoded, blockNumber, blockTimestamp, event);
            break;
          case "LiquidityAdded":
            await handleLiquidityAdded(db, decoded, blockNumber, blockTimestamp, event);
            break;
          case "LiquidityRemoved":
            await handleLiquidityRemoved(db, decoded, blockNumber, blockTimestamp, event);
            break;
          case "PoolFeeChanged":
            await handlePoolFeeChanged(db, decoded, blockNumber, blockTimestamp, event);
            break;
          // FeeRecipientChanged is admin-only, log but no table needed
        }
      }
    },
  });
}
```

### Reserve Tracking Strategy

The AMM contract's `Swap`, `LiquidityAdded`, and `LiquidityRemoved` events do NOT emit the post-event reserves. Two
approaches:

**Option A -- Compute from events (recommended):** Track reserves in the `pools` table. On each event, update reserves:

- `Swap` (lords_in): `lords_reserve += amount_in; token_reserve -= (amount_out + protocol_fee)`
- `LiquidityAdded`: `lords_reserve += lords_amount; token_reserve += token_amount; lp_supply += lp_minted`
- `LiquidityRemoved`: `lords_reserve -= lords_amount; token_reserve -= token_amount; lp_supply -= lp_burned`

**Option B -- Periodic RPC snapshots:** Call `get_reserves(token)` via RPC on a schedule. Simpler but introduces lag.

**Recommendation:** Use Option A for real-time accuracy, with Option B as a periodic reconciliation check.

### Chain Reorg Handling

Apibara's Drizzle plugin handles reorgs automatically by:

1. Creating audit tables that track all inserts/updates/deletes per block
2. On reorg (`message:invalidate`), rolling back all changes for invalidated blocks
3. No manual handling needed -- the plugin wraps everything in DB transactions

### Candle Aggregation Strategy

Two approaches (recommended: hybrid):

**Option A -- Materialized views (PostgreSQL):**

```sql
CREATE MATERIALIZED VIEW candles_1h AS
SELECT token_address, date_trunc('hour', block_timestamp) AS open_time, ...
FROM swaps GROUP BY token_address, date_trunc('hour', block_timestamp);
```

**Option B -- Compute in transform (real-time):** Update candle rows incrementally on each swap event in the transform
function.

**Recommended:** Use materialized views for historical candles (1h, 4h, 1d) and real-time computation for short
intervals (1m, 5m, 15m).

---

## TypeScript SDK Design

### Recommended Package: `@bibliothecadao/amm-sdk`

Following the existing Eternum SDK patterns, the package should mirror the split between read operations (SQL/API
queries) and write operations (starknet.js contract calls).

### Package Structure

```
packages/amm-sdk/
  package.json
  tsconfig.json
  tsup.config.ts
  src/
    index.ts                     # Public exports
    types.ts                     # All TypeScript types/interfaces
    constants.ts                 # Contract addresses, ABIs, selectors
    abi.ts                       # Starknet contract ABI (JSON)

    # Read layer (from indexer API)
    api/
      client.ts                  # AmmApiClient class
      queries.ts                 # SQL query strings (if using Torii-style)

    # Write layer (contract interactions)
    transactions/
      swap.ts                    # SwapTransactions class
      liquidity.ts               # LiquidityTransactions class
      admin.ts                   # AdminTransactions class

    # Utility functions
    utils/
      math.ts                    # Client-side AMM math (mirrors Cairo math)
      formatting.ts              # Amount formatting, address formatting
      price.ts                   # Price impact, optimal liquidity calculations
```

### Key Types

```typescript
// src/types.ts
export interface Pool {
  tokenAddress: string;
  lpTokenAddress: string;
  lordsReserve: bigint;
  tokenReserve: bigint;
  totalLpSupply: bigint;
  lpFeeNum: bigint;
  lpFeeDenom: bigint;
  protocolFeeNum: bigint;
  protocolFeeDenom: bigint;
  createdAt: Date;
}

export interface SwapEvent {
  userAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  protocolFee: bigint;
  price: number;
  blockTimestamp: Date;
  txHash: string;
}

export interface LiquidityEvent {
  providerAddress: string;
  tokenAddress: string;
  eventType: "add" | "remove";
  lordsAmount: bigint;
  tokenAmount: bigint;
  lpAmount: bigint;
  blockTimestamp: Date;
  txHash: string;
}

export interface PriceCandle {
  openTime: Date;
  closeTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
  tradeCount: number;
}

export interface PoolStats {
  tvlLords: bigint;
  volume24h: bigint;
  volume7d: bigint;
  fees24h: bigint;
  apr: number;
  priceChange24h: number;
}

export interface SwapQuote {
  amountOut: bigint;
  priceImpact: number;
  minimumReceived: bigint;
  fee: bigint;
  route: string[]; // for token-to-token via LORDS
}
```

### Read Operations (API Client)

```typescript
// src/api/client.ts
export class AmmApiClient {
  constructor(private baseUrl: string) {}

  async getPools(): Promise<Pool[]> {
    /* GET /api/v1/pools */
  }
  async getPool(tokenAddress: string): Promise<Pool | null> {
    /* GET /api/v1/pools/:token */
  }
  async getSwapHistory(tokenAddress: string, opts?: PaginationOpts): Promise<SwapEvent[]> {
    /* ... */
  }
  async getLiquidityHistory(tokenAddress: string, opts?: PaginationOpts): Promise<LiquidityEvent[]> {
    /* ... */
  }
  async getPriceHistory(tokenAddress: string, interval: CandleInterval, opts?: TimeRangeOpts): Promise<PriceCandle[]> {
    /* ... */
  }
  async getPoolStats(tokenAddress: string): Promise<PoolStats> {
    /* ... */
  }
  async getUserPositions(userAddress: string): Promise<UserPosition[]> {
    /* ... */
  }
}
```

### Write Operations (Transaction Classes)

Following the exact pattern from `packages/client/src/transactions/bank.ts`:

```typescript
// src/transactions/swap.ts
import type { Call } from "starknet";

export class SwapTransactions {
  constructor(
    private ammAddress: string,
    private lordsAddress: string,
  ) {}

  swapLordsForToken(props: { token: string; lordsAmount: bigint; minTokenOut: bigint; deadline: number }): Call {
    return {
      contractAddress: this.ammAddress,
      entrypoint: "swap_lords_for_token",
      calldata: [props.token, ...uint256(props.lordsAmount), ...uint256(props.minTokenOut), props.deadline],
    };
  }

  swapTokenForLords(props: { token: string; tokenAmount: bigint; minLordsOut: bigint; deadline: number }): Call {
    return {
      contractAddress: this.ammAddress,
      entrypoint: "swap_token_for_lords",
      calldata: [props.token, ...uint256(props.tokenAmount), ...uint256(props.minLordsOut), props.deadline],
    };
  }

  // Builds approval + swap multicall
  swapLordsForTokenWithApproval(props: {
    token: string;
    lordsAmount: bigint;
    minTokenOut: bigint;
    deadline: number;
  }): Call[] {
    return [
      {
        contractAddress: this.lordsAddress,
        entrypoint: "approve",
        calldata: [this.ammAddress, ...uint256(props.lordsAmount)],
      },
      this.swapLordsForToken(props),
    ];
  }

  swapTokenForToken(props: {
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    minAmountOut: bigint;
    deadline: number;
  }): Call {
    return {
      contractAddress: this.ammAddress,
      entrypoint: "swap_token_for_token",
      calldata: [
        props.tokenIn,
        props.tokenOut,
        ...uint256(props.amountIn),
        ...uint256(props.minAmountOut),
        props.deadline,
      ],
    };
  }
}
```

### Utility Functions (Client-side Math)

Port the Cairo math to TypeScript for client-side quote estimation:

```typescript
// src/utils/math.ts

/** Mirrors contracts/amm/src/math.cairo::get_input_price */
export function getInputPrice(
  feeNum: bigint,
  feeDenom: bigint,
  inputAmount: bigint,
  inputReserve: bigint,
  outputReserve: bigint,
): bigint {
  const inputAfterFee = (inputAmount * (feeDenom - feeNum)) / feeDenom;
  const numerator = inputAfterFee * outputReserve;
  const denominator = inputReserve + inputAfterFee;
  return numerator / denominator;
}

/** Mirrors contracts/amm/src/math.cairo::get_output_price */
export function getOutputPrice(
  feeNum: bigint,
  feeDenom: bigint,
  outputAmount: bigint,
  inputReserve: bigint,
  outputReserve: bigint,
): bigint {
  const numerator = inputReserve * outputAmount * feeDenom;
  const denominator = (outputReserve - outputAmount) * (feeDenom - feeNum);
  return numerator / denominator + 1n;
}

/** Compute price impact as a percentage */
export function computePriceImpact(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeNum: bigint,
  feeDenom: bigint,
): number {
  const spotPrice = Number(reserveOut) / Number(reserveIn);
  const amountOut = getInputPrice(feeNum, feeDenom, amountIn, reserveIn, reserveOut);
  const executionPrice = Number(amountOut) / Number(amountIn);
  return Math.abs((executionPrice - spotPrice) / spotPrice) * 100;
}

/** Compute optimal token amount for adding liquidity given a lords amount */
export function computeOptimalLiquidity(lordsAmount: bigint, lordsReserve: bigint, tokenReserve: bigint): bigint {
  if (lordsReserve === 0n) return 0n;
  return (lordsAmount * tokenReserve) / lordsReserve;
}

/** Compute LP tokens that would be minted */
export function computeLpMint(lordsAdded: bigint, lordsReserve: bigint, totalLpSupply: bigint): bigint {
  if (totalLpSupply === 0n) return lordsAdded;
  return (lordsAdded * totalLpSupply) / lordsReserve;
}

/** Compute tokens received when burning LP */
export function computeLpBurn(
  lpAmount: bigint,
  lordsReserve: bigint,
  tokenReserve: bigint,
  totalLpSupply: bigint,
): { lordsOut: bigint; tokenOut: bigint } {
  return {
    lordsOut: (lpAmount * lordsReserve) / totalLpSupply,
    tokenOut: (lpAmount * tokenReserve) / totalLpSupply,
  };
}
```

### Top-level Client

```typescript
// src/index.ts
import { Account, type Call } from "starknet";

export class AmmClient {
  readonly api: AmmApiClient;
  readonly swap: SwapTransactions;
  readonly liquidity: LiquidityTransactions;
  readonly admin: AdminTransactions;

  constructor(config: { ammAddress: string; lordsAddress: string; indexerUrl: string }) {
    this.api = new AmmApiClient(config.indexerUrl);
    this.swap = new SwapTransactions(config.ammAddress, config.lordsAddress);
    this.liquidity = new LiquidityTransactions(config.ammAddress, config.lordsAddress);
    this.admin = new AdminTransactions(config.ammAddress);
  }

  /** Execute calls with an account */
  async execute(account: Account, calls: Call | Call[]): Promise<string> {
    const callArray = Array.isArray(calls) ? calls : [calls];
    const result = await account.execute(callArray);
    return result.transaction_hash;
  }

  /** Get a swap quote (client-side, no RPC needed) */
  async quoteSwap(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<SwapQuote> {
    // Fetch pool from indexer, compute using math utils
    // ...
  }
}
```

---

## API Design Recommendations

### REST API Endpoints

```
GET  /api/v1/pools                                         # List all pools
GET  /api/v1/pools/:tokenAddress                           # Single pool details
GET  /api/v1/pools/:tokenAddress/swaps?limit=50&offset=0   # Swap history
GET  /api/v1/pools/:tokenAddress/liquidity                 # Liquidity events
GET  /api/v1/pools/:tokenAddress/candles?interval=1h       # OHLCV candles
GET  /api/v1/pools/:tokenAddress/stats                     # TVL, volume, APR
GET  /api/v1/users/:address/positions                      # LP positions for user
GET  /api/v1/quote?tokenIn=...&tokenOut=...&amountIn=...   # Swap quote
```

**Why REST over GraphQL:** Simpler to implement, cache, and consume. The data access patterns are well-defined. Aligns
with Eternum's existing Torii SQL endpoint pattern.

### Real-time Updates

**Recommended: Server-Sent Events (SSE)**

```
GET /api/v1/pools/:tokenAddress/stream  # SSE stream of pool updates
```

Simpler than WebSocket, works through proxies, one-directional (server to client). The indexer can publish events to
Redis pub/sub and the API server streams them to clients.

### Pagination Pattern

Follow offset-based pagination (consistent with existing Eternum patterns):

```json
{
  "data": [...],
  "pagination": { "total": 1234, "limit": 50, "offset": 0, "hasMore": true }
}
```

---

## Codebase Analysis

### Key files examined:

| File                                            | Relevance                                                 |
| ----------------------------------------------- | --------------------------------------------------------- |
| `contracts/amm/src/amm.cairo`                   | Complete AMM contract with 6 event types, view functions  |
| `contracts/amm/src/math.cairo`                  | Constant-product math (x\*y=k) -- must port to TypeScript |
| `packages/torii/src/queries/sql/trading.ts`     | Existing swap event query pattern                         |
| `packages/torii/src/types/sql.ts`               | Existing `SwapEventResponse` interface                    |
| `packages/client/src/client.ts`                 | `EternumClient` architecture pattern                      |
| `packages/client/src/transactions/bank.ts`      | Transaction class pattern for AMM ops                     |
| `packages/provider/src/transaction-executor.ts` | `TransactionExecutor` interface                           |
| `contracts/game/ext/scripts/indexer.sh`         | Torii startup script pattern                              |

### AMM Contract Events (from `contracts/amm/src/amm.cairo`):

| Event                 | Key fields                                                     | Indexed keys                    |
| --------------------- | -------------------------------------------------------------- | ------------------------------- |
| `PoolCreated`         | token, lp_token, fee config                                    | `#[key] token`                  |
| `LiquidityAdded`      | token, provider, amounts, lp_minted                            | `#[key] token, #[key] provider` |
| `LiquidityRemoved`    | token, provider, amounts, lp_burned                            | `#[key] token, #[key] provider` |
| `Swap`                | user, token_in, token_out, amount_in, amount_out, protocol_fee | `#[key] user`                   |
| `PoolFeeChanged`      | token, fee config                                              | `#[key] token`                  |
| `FeeRecipientChanged` | old_recipient, new_recipient                                   | none                            |

---

## Sources

- [Apibara Documentation - Indexers](https://www.apibara.com/docs/getting-started/indexers)
- [Apibara Documentation - Installation](https://www.apibara.com/docs/getting-started/installation)
- [Apibara - Starknet Filter Reference](https://www.apibara.com/docs/networks/starknet/filter)
- [Apibara - Starknet Event Decoder](https://www.apibara.com/docs/networks/starknet/decoder)
- [Apibara - Starknet Helpers](https://www.apibara.com/docs/networks/starknet/helpers)
- [Apibara - Drizzle with PostgreSQL](https://www.apibara.com/docs/storage/drizzle-pg)
- [Apibara - Starknet Network Config](https://www.apibara.com/docs/networks/starknet)
- [EkuboProtocol/indexer on GitHub](https://github.com/EkuboProtocol/indexer)
- [Apibara DNA GitHub](https://github.com/apibara/dna)
- Codebase: `contracts/amm/src/amm.cairo`, `packages/torii/`, `packages/client/`, `packages/provider/`

## Recommendations

1. **Use Apibara with Drizzle/PostgreSQL** for the AMM indexer. It is purpose-built for Starknet event indexing with
   built-in reorg handling and type-safe event decoding.

2. **Do NOT try to use Torii** for the standalone AMM contract. Torii is tightly coupled to Dojo's world/model paradigm.
   The AMM is a standalone Starknet contract (not a Dojo contract), so Torii cannot index it natively.

3. **Follow the Ekubo pattern**: Catalogue events raw, use materialized views for derived data (candles, stats). This is
   simpler and more maintainable than computing everything in the transform function.

4. **Create the SDK as `packages/amm-sdk/`** in the monorepo, following the exact package structure of existing packages
   (`tsup`, `vitest`, `workspace:*` references).

5. **Port the Cairo math to TypeScript** for client-side quote estimation. The math is simple constant-product formulas
   and can be computed without RPC calls.

6. **Start with REST API + SSE** for the indexer's query layer. GraphQL adds unnecessary complexity for well-defined AMM
   data access patterns.

7. **Deploy the indexer separately** from the game infrastructure. It has different scaling characteristics and can run
   as a standalone service.

8. **Use `numeric` (not `bigint`)** in PostgreSQL for u256 values. PostgreSQL bigint maxes at 2^63, while Starknet u256
   values can be much larger.

## Open Questions

1. **Hosted vs self-hosted Apibara?** The hosted streams (a5a.ch) require a `DNA_TOKEN` and may have rate limits.
   Self-hosting the DNA service is possible but adds infrastructure complexity.

2. **Does the AMM contract deploy to a known address?** The indexer needs the contract address at configuration time. If
   using CREATE2-style deterministic deployment, the address can be computed ahead of time.

3. **Should the indexer API be a separate service or embedded?** The Apibara indexer itself is a long-running process.
   The REST API could be served by a separate Express/Hono server querying the same PostgreSQL database, or via a Hono
   plugin within the Apibara process.

4. **Token metadata**: How are token names/symbols/decimals resolved? The indexer may need a supplementary script (like
   Ekubo's `sync-tokens.ts`) to fetch ERC20 metadata for display purposes.

5. **Should the SDK depend on `@bibliothecadao/client` or be standalone?** If the AMM is used outside the Eternum game
   context, a standalone package is better. If it is always used within Eternum, integrating into the existing
   `EternumClient` (adding `amm: AmmTransactions`) may be cleaner.
