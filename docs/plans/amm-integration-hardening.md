# AMM Integration Hardening

This document turns the AMM review findings into a concrete fix plan.

The goal is not to redesign the feature.

The goal is to make the shipped AMM stack behave like one coherent product:

- the SDK must understand the indexer API it ships with
- the dashboard must use live deployment state instead of scaffolding
- swap and liquidity actions must execute the correct contract calls
- indexed reserves and candles must stay aligned with onchain state

## Product Goal

The `/amm` route should be usable against a real deployment without hidden manual setup or misleading quotes.

A user should be able to:

1. load pools from the configured indexer
2. select a pool and see matching history and candles
3. quote swaps against real reserves
4. send swaps and liquidity actions against the configured AMM contracts
5. trust that routed swaps do not corrupt indexed analytics

## Problems To Fix

- The SDK API client fetches the wrong paths and expects the wrong response shape.
- SDK quotes ignore protocol fees even though the contract deducts them from output.
- The game client uses placeholder AMM addresses and a hardcoded indexer URL.
- The game dashboard computes and executes against `MOCK_POOL` instead of the selected live pool.
- The swap flow omits approval calls and therefore reverts for users without existing allowances.
- The indexer treats routed token-to-token swaps as if they mutated one pool.
- The game feature was added without the required latest-features entry.

## Fix Principles

### One Protocol Contract

The SDK and indexer API must agree on:

- base path
- wrapper shape
- numeric encoding
- timestamp encoding

The game client should consume typed SDK objects, not raw database JSON.

### Live Data First

The dashboard should not have a fake happy path.

If AMM config is missing:

- reads should explain that the AMM is not configured
- writes should stay disabled

If AMM config exists:

- every quote and write path should use real pools and addresses

### Pool-Safe Accounting

Every indexed reserve mutation must match the contract’s actual reserve mutation.

Routed swaps are two pool updates, not one.

The indexer should reason in pool hops, not only in route-level event labels.

## Workstreams

### 1. SDK And API Alignment

Build a single typed decoding path in `packages/amm-sdk` that:

- normalizes the base URL to `/api/v1`
- unwraps `{ data: ... }` payloads
- converts stringified numerics into `bigint` or `number`
- converts server timestamps into unix seconds

Acceptance:

- `getPools`, `getPool`, `getSwapHistory`, `getLiquidityHistory`, `getPriceHistory`, `getPoolStats`, and
  `getUserPositions` return the types declared by the SDK
- callers do not need to know the server’s storage format

### 2. Fee-Aware Quotes

Update SDK quote helpers so swap output reflects both:

- LP fee
- protocol fee deducted from output

Acceptance:

- `quoteSwap` matches contract semantics for direct swaps
- token-to-token UI quotes can be composed from two direct quotes without overstating output

### 3. Game Dashboard Wiring

Replace dashboard scaffolding with live state:

- resolve AMM runtime config from environment
- fetch and select live pools
- derive token options from live pools plus LORDS
- route swap execution through the selected pool or the selected route
- use approval multicalls for swaps that require allowances
- use the selected live pool for add/remove liquidity

Acceptance:

- the selected pool affects quotes, history, candles, and liquidity calls
- direct swaps use approval builders
- routed swaps use token-to-token approval builders
- missing runtime config produces a clear disabled state instead of fake behavior

### 4. Indexer Routed Swap Accounting

Teach the indexer to decompose a routed swap into two pool-level mutations using:

- current reserves
- per-pool LP fees
- per-pool protocol fees

Then:

- update both pools
- update both candle streams
- persist per-pool swap rows for pool-scoped history queries

Acceptance:

- a token-to-token swap no longer corrupts either pool
- pool history for either touched pool includes the routed hop that affected it

### 5. UX Bookkeeping

Add the missing latest-features entry for the AMM dashboard.

## TDD Plan

### Red 1: SDK API Decoding

Add failing SDK tests for:

- `/api/v1` base-path normalization
- wrapped pool payload decoding
- wrapped candle payload decoding
- wrapped paginated swap payload decoding
- user-position decoding from server fields

### Green 1

Implement response decoding helpers in the SDK API client.

### Red 2: Protocol Fee Quotes

Add failing SDK tests proving that:

- direct quotes subtract protocol fees from output
- minimum received is computed from net output

### Green 2

Implement protocol-fee-aware quoting.

### Red 3: Game Runtime Wiring

Add failing game tests for:

- AMM runtime config resolution from env
- swap call construction using approval helpers
- live selected-pool routing for liquidity actions

### Green 3

Implement live AMM config, pool resolution, and transaction-building helpers.

### Red 4: Routed Indexer Accounting

Add failing indexer tests for:

- direct swap pool mutation
- routed swap mutating both pools
- routed swap producing per-pool history rows

### Green 4

Implement pool-hop accounting helpers and wire them into the indexer transform.

## Verification

- targeted SDK tests
- targeted game tests
- targeted indexer tests
- `pnpm run format`
- `pnpm run knip`

## Non-Goals

- redesigning the AMM UI
- adding wallet-balance reads
- adding new contract entrypoints solely for dashboard ergonomics
