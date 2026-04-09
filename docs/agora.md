# The Agora -- Eternum AMM

The Agora is Eternum's on-chain automated market maker for trading LORDS against game resources. Each tradable resource
has a dedicated LORDS/Resource pool using the constant-product (x \* y = k) formula. Token-to-token swaps that don't
involve LORDS are routed through two pools automatically (Token A -> LORDS -> Token B).

## Architecture Overview

The system has four layers:

```
Cairo Contracts          Indexer                SDK                 Game UI
(contracts/amm/)   -->  (amm-indexerv2/)  -->  (amm-sdk/)    -->  (amm/ feature)
On-chain AMM            Hono API server      TypeScript client   React dashboard
Starknet events         PostgreSQL + Drizzle  @bibliothecadao/    Swap, Liquidity,
                        OHLCV candles          amm-sdk            Charts, History
```

**Data flow:**

```
Starknet Blockchain
       |
       | (on-chain events: Swap, AddLiquidity, RemoveLiquidity, PoolCreated)
       v
  AMM Indexer (Hono + Drizzle ORM + PostgreSQL)
       |
       | (REST API: /api/v1/pools, /swaps, /candles, /stats, /quote)
       v
  AMM SDK (AmmClient)
       |
       | (TypeScript: getPools, quoteSwap, buildSwapCalls, etc.)
       v
  Game UI (React: AmmDashboard, AmmSwap, AmmAddLiquidity, etc.)
```

### 1. Cairo Contracts (`contracts/amm/`)

Package: `eternum_amm` (Scarb 2.13.1, Cairo edition 2024_07).

Dependencies include OpenZeppelin contracts for access control, token standards (ERC-20 LP tokens), and upgradeability.

Source files:

- `src/amm.cairo` -- Main AMM contract with pool management, swap, and liquidity entrypoints
- `src/math.cairo` -- Constant-product math (mirrored in the SDK as `utils/math.ts`)
- `src/lp_token.cairo` -- ERC-20 LP token contract deployed per pool
- `src/tests/` -- snforge integration tests

Key contract entrypoints (called by the SDK):

- `swap_lords_for_token(token_address, lords_amount, min_token_out, deadline)`
- `swap_token_for_lords(token_address, token_amount, min_lords_out, deadline)`
- `swap_token_for_token(token_in, token_out, amount_in, min_amount_out, deadline)`
- `add_liquidity(token_address, lords_amount, token_amount, lords_min, token_min, deadline)`
- `remove_liquidity(token_address, lp_amount, lords_min, token_min, deadline)`
- `create_pool(token_address, lp_fee_num, lp_fee_denom, protocol_fee_num, protocol_fee_denom)` (admin)
- `set_pool_fee(...)`, `set_fee_recipient(recipient)`, `set_paused(paused)` (admin)

### 2. Indexer (`client/apps/amm-indexerv2/`)

A Hono API server that indexes AMM factory and pair events into PostgreSQL via Drizzle ORM. It serves pair discovery,
swap history, liquidity events, OHLCV price candles, pool statistics, and LP holder positions.

Database schema (Drizzle, in `src/schema.ts`):

- `factories` -- Factory fee settings and pair counts
- `pairs` -- Current pair state (token addresses, reserves, LP supply)
- `pair_swaps` -- Every swap event with token in/out amounts and fee amount
- `pair_liquidity_events` -- Every add/remove liquidity event
- `pair_lp_balances` -- Current LP balances by pair and owner
- `pair_price_candles` -- OHLCV candles keyed by pair and interval

### 3. SDK (`packages/amm-sdk/`)

Package: `@bibliothecadao/amm-sdk` (published as ESM, built with tsup).

The SDK provides:

- `AmmClient` -- Top-level client composing API access, transaction builders, and quoting
- `AmmApiClient` -- REST client for the indexer
- `SwapTransactions` -- Builds Starknet `Call` objects for swaps
- `LiquidityTransactions` -- Builds Starknet `Call` objects for add/remove liquidity
- `AdminTransactions` -- Builds Starknet `Call` objects for pool creation and admin ops
- Math utilities (`getInputPrice`, `getOutputPrice`, `quote`, `computeAddLiquidity`, `computeLpMint`, `computeLpBurn`)
- Price utilities (`computePriceImpact`, `computeMinimumReceived`, `computeSpotPrice`)
- Format utilities (`formatTokenAmount`, `parseTokenAmount`)
- Standalone AMM resource registry (maps mainnet resource addresses to human-readable names)

### 4. Game UI (`client/apps/game/src/ui/features/amm/`)

A React dashboard embedded in the game client, composed of:

- `amm-dashboard.tsx` -- Main layout with pool rail, summary, action tabs, and price chart
- `amm-swap.tsx` -- Swap form with pay/receive inputs, route display, slippage control, and confirmation dialog
- `amm-model.ts` -- Pure functions for route resolution, pool selection, and token option building
- `amm-add-liquidity.tsx` / `amm-remove-liquidity.tsx` -- Liquidity management forms
- `amm-pool-list.tsx` -- Pool selector sidebar
- `amm-price-chart.tsx` -- OHLCV chart component
- `amm-trade-history.tsx` -- Recent swap history table
- `amm-token-input.tsx` -- Reusable token amount input with dropdown
- `amm-format.ts` -- Display formatting helpers
- `amm-asset-presentation.ts` -- Token name/icon resolution
- `amm-swap-confirmation.tsx` -- Pre-swap confirmation modal

State management: `useAmmStore` (zustand) holds `selectedPool` and `slippageBps` (default 50 = 0.5%).

## Fee Structure

Fees are configurable per pool via rational number pairs (numerator/denominator). The fee parameters are stored on-chain
and in the indexer's `pools` table.

- **LP Fee**: Deducted from the input amount before the swap calculation. Accrues to liquidity providers as increased
  reserves. Configured as `feeNum / feeDenom` (e.g., `1/100` = 1%).
- **Protocol Fee**: Deducted from the gross output amount after the swap calculation. Directed to veLORDS holders via a
  configurable fee recipient. Configured as `protocolFeeNum / protocolFeeDenom` (e.g., `3/100` = 3%).
- **Total effective fee**: Both fees apply sequentially, not additively.

The SDK's `quoteSwap` method computes the net output after both fees are applied.

## Key Concepts

### Pools

Each pool is a LORDS/Resource pair. Pools are created by an admin via `create_pool` with specified fee parameters. Each
pool deploys its own ERC-20 LP token contract. Pool state (reserves, LP supply) is stored on-chain and mirrored in the
indexer.

### Routing

The SDK and UI support two swap route types (see `amm-model.ts`):

- **Direct** (`kind: "direct"`): LORDS <-> Token. Uses a single pool.
- **Routed** (`kind: "routed"`): Token A -> Token B. Routes through two pools via LORDS as intermediary (Token A ->
  LORDS in pool A, then LORDS -> Token B in pool B).

Route resolution is handled by `resolveAmmSwapRoute()` which inspects whether either token is LORDS and finds matching
pools.

### Liquidity

Liquidity providers deposit both LORDS and the paired token proportionally to the current pool ratio (enforced by
`computeAddLiquidity`). In return they receive LP tokens representing their share. When removing liquidity, LP tokens
are burned and both tokens are returned proportionally via `computeLpBurn`.

First depositor: LP minted = `lordsAmount - MINIMUM_LIQUIDITY` (1000 wei locked permanently). Subsequent deposits: LP
minted = `(lordsAdded * totalLpSupply) / lordsReserve`.

### Slippage

Configurable tolerance stored in zustand (`slippageBps`, default 50 = 0.5%). The UI offers preset buttons for 0.25%,
0.5%, 1.0%, and 2.0%. Slippage is applied via `computeMinimumReceived` to calculate the `minAmountOut` passed to the
contract. The contract reverts if the actual output is below this minimum.

### Deadlines

All swap and liquidity transactions include a deadline parameter (unix timestamp). Default is current time + 1200
seconds (20 minutes), configurable via the `deadline` prop on transaction builders.

## Developing with the SDK

### Install

```bash
pnpm add @bibliothecadao/amm-sdk
```

### Create a client

```typescript
import { AmmClient } from "@bibliothecadao/amm-sdk";

const client = new AmmClient({
  ammAddress: "0x04a11ce...",
  lordsAddress: "0x...",
  indexerUrl: "http://127.0.0.1:3001",
});
```

### Fetch pools

```typescript
const pools = await client.api.getPools();
const pool = await client.api.getPool(tokenAddress);
```

### Get a swap quote

```typescript
const quote = client.quoteSwap(pool, amountIn, isLordsInput, slippageBps);
// Returns: { amountOut, priceImpact, minimumReceived, spotPriceBefore, spotPriceAfter }
```

Or use the standalone math function:

```typescript
import { getInputPrice } from "@bibliothecadao/amm-sdk";

const grossOut = getInputPrice(feeNum, feeDenom, amountIn, inputReserve, outputReserve);
```

### Build swap calls

Direct swaps (LORDS -> Token):

```typescript
const calls = client.swap.swapLordsForTokenWithApproval({
  ammAddress: client.ammAddress,
  lordsAddress: client.lordsAddress,
  tokenAddress: pool.tokenAddress,
  lordsAmount: amountIn,
  minTokenOut: quote.minimumReceived,
});
// Returns: [approveCall, swapCall]
```

Direct swaps (Token -> LORDS):

```typescript
const calls = client.swap.swapTokenForLordsWithApproval({
  ammAddress: client.ammAddress,
  tokenAddress: pool.tokenAddress,
  tokenAmount: amountIn,
  minLordsOut: quote.minimumReceived,
});
```

Routed swaps (Token -> Token):

```typescript
const calls = client.swap.swapTokenForTokenWithApproval({
  ammAddress: client.ammAddress,
  tokenInAddress: inputPool.tokenAddress,
  tokenOutAddress: outputPool.tokenAddress,
  amountIn,
  minAmountOut: quote.minimumReceived,
});
```

### Execute calls

```typescript
const txHash = await client.execute(account, calls);
```

Or directly with a Starknet account:

```typescript
const result = await account.execute(calls);
```

### Add liquidity

```typescript
const calls = client.liquidity.addLiquidityWithApproval({
  ammAddress: client.ammAddress,
  lordsAddress: client.lordsAddress,
  tokenAddress: pool.tokenAddress,
  lordsAmount,
  tokenAmount,
  lordsMin,
  tokenMin,
});
```

### Remove liquidity

```typescript
const call = client.liquidity.removeLiquidity({
  ammAddress: client.ammAddress,
  tokenAddress: pool.tokenAddress,
  lpAmount,
  lordsMin,
  tokenMin,
});
```

### Liquidity math helpers

```typescript
import { computeAddLiquidity, computeLpMint, computeLpBurn } from "@bibliothecadao/amm-sdk";

// Compute optimal deposit amounts maintaining pool ratio
const { lordsUsed, tokenUsed } = computeAddLiquidity(lordsDesired, tokenDesired, lordsReserve, tokenReserve);

// Estimate LP tokens minted
const lpMinted = computeLpMint(lordsAdded, lordsReserve, totalLpSupply);

// Estimate tokens returned when burning LP
const { lordsOut, tokenOut } = computeLpBurn(lpAmount, lordsReserve, tokenReserve, totalLpSupply);
```

### Pool statistics and history

```typescript
const stats = await client.api.getPoolStats(tokenAddress);
// Returns: { tokenAddress, tvlLords, volume24h, fees24h, swapCount24h, spotPrice }

const swaps = await client.api.getSwapHistory(tokenAddress, { limit: 50, offset: 0, from: timestamp, to: timestamp });
// Returns: PaginatedResponse<SwapEvent>

const liquidityEvents = await client.api.getLiquidityHistory(tokenAddress, { limit: 50 });
// Returns: PaginatedResponse<LiquidityEvent>

const candles = await client.api.getPriceHistory(tokenAddress, "1h", { from: timestamp, to: timestamp });
// Returns: PriceCandle[]

const positions = await client.api.getUserPositions(userAddress);
// Returns: UserPosition[]
```

### Admin operations

```typescript
// Create a new pool (owner only)
const call = client.admin.createPool({
  ammAddress: client.ammAddress,
  tokenAddress: "0x...",
  lpFeeNum: 1n,
  lpFeeDenom: 100n,
  protocolFeeNum: 3n,
  protocolFeeDenom: 100n,
});

// Update fee parameters
const call = client.admin.setPoolFee({ ... });

// Set protocol fee recipient
const call = client.admin.setFeeRecipient({ ammAddress: client.ammAddress, recipient: "0x..." });

// Pause/unpause the AMM
const call = client.admin.setPaused({ ammAddress: client.ammAddress, paused: true });
```

## Indexer API

Base path: `/api/v1`. All responses use JSON with bigints serialized as strings. CORS is restricted to localhost
origins.

### Endpoints

| Method | Path                                    | Description                                                                                                                                                                                                           |
| ------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/pools`                         | List all pools. Returns `{ data: Pool[] }`                                                                                                                                                                            |
| `GET`  | `/api/v1/pools/:tokenAddress`           | Get a single pool by token address. Returns `{ data: Pool }`                                                                                                                                                          |
| `GET`  | `/api/v1/pools/:tokenAddress/swaps`     | Paginated swap history for a pool. Query params: `limit`, `offset`. Returns `{ data: SwapEvent[], pagination }`                                                                                                       |
| `GET`  | `/api/v1/pools/:tokenAddress/liquidity` | Paginated liquidity event history. Query params: `limit`, `offset`. Returns `{ data: LiquidityEvent[], pagination }`                                                                                                  |
| `GET`  | `/api/v1/pools/:tokenAddress/candles`   | OHLCV price candles. Query params: `interval` (default `1h`), `from`, `to`. Max 1000 rows. Returns `{ data: PriceCandle[] }`                                                                                          |
| `GET`  | `/api/v1/pools/:tokenAddress/stats`     | Aggregate 24h stats (volume, fees, trades, TVL, APR). Returns `{ data: PoolStats }`                                                                                                                                   |
| `GET`  | `/api/v1/users/:address/positions`      | User's LP positions across all pools (computed from liquidity event history). Returns `{ data: UserPosition[] }`                                                                                                      |
| `GET`  | `/api/v1/quote`                         | Server-side swap quote. Query params: `tokenIn`, `tokenOut`, `amountIn`. Returns `{ data: { amountIn, amountOut, protocolFee, priceImpact, route } }`. Note: token-to-token quotes are not yet supported server-side. |

### Pagination

Paginated endpoints accept `limit` (1-500, default 50) and `offset` (default 0). Responses include:

```json
{
  "pagination": {
    "total": 142,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

## Environment Variables

The game client reads AMM configuration from Vite env vars, with defaults pointing to the standalone AMM setup:

| Variable                        | Purpose                          | Default                                         |
| ------------------------------- | -------------------------------- | ----------------------------------------------- |
| `VITE_PUBLIC_AMM_ADDRESS`       | AMM contract address on Starknet | `DEFAULT_STANDALONE_AMM_ADDRESS` from SDK       |
| `VITE_PUBLIC_AMM_LORDS_ADDRESS` | LORDS token contract address     | `DEFAULT_STANDALONE_AMM_LORDS_ADDRESS` from SDK |
| `VITE_PUBLIC_AMM_INDEXER_URL`   | Base URL for the AMM indexer API | `http://127.0.0.1:3001`                         |

All three must be non-empty for the AMM UI to activate. The `useAmm` hook checks `isConfigured` and returns `null` for
`client` if any are missing.

## File Map

| Path                                                            | Purpose                                                                                                                                 |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `contracts/amm/src/amm.cairo`                                   | Main AMM contract (pools, swaps, liquidity, admin)                                                                                      |
| `contracts/amm/src/math.cairo`                                  | On-chain constant-product math                                                                                                          |
| `contracts/amm/src/lp_token.cairo`                              | ERC-20 LP token contract                                                                                                                |
| `contracts/amm/src/tests/`                                      | Cairo integration tests (snforge)                                                                                                       |
| `contracts/amm/Scarb.toml`                                      | Cairo package config (eternum_amm v1.0.0)                                                                                               |
| `client/apps/amm-indexerv2/api/app.ts`                          | Hono REST API definition for factory, pair, swap, liquidity, candle, and LP position endpoints                                          |
| `client/apps/amm-indexerv2/src/schema.ts`                       | Drizzle ORM schema for factories, pairs, swaps, liquidity events, LP balances, transfers, and candles                                   |
| `packages/amm-sdk/src/index.ts`                                 | SDK entry point, `AmmClient` class, re-exports                                                                                          |
| `packages/amm-sdk/src/api/client.ts`                            | `AmmApiClient` -- REST client for the indexer                                                                                           |
| `packages/amm-sdk/src/transactions/swap.ts`                     | `SwapTransactions` -- builds Starknet swap Calls                                                                                        |
| `packages/amm-sdk/src/transactions/liquidity.ts`                | `LiquidityTransactions` -- builds Starknet liquidity Calls                                                                              |
| `packages/amm-sdk/src/transactions/admin.ts`                    | `AdminTransactions` -- builds Starknet admin Calls                                                                                      |
| `packages/amm-sdk/src/utils/math.ts`                            | Constant-product math (TypeScript port of math.cairo)                                                                                   |
| `packages/amm-sdk/src/utils/price.ts`                           | Price impact, minimum received, spot price helpers                                                                                      |
| `packages/amm-sdk/src/utils/format.ts`                          | `formatTokenAmount`, `parseTokenAmount`                                                                                                 |
| `packages/amm-sdk/src/standalone.ts`                            | Standalone AMM defaults and resource name registry                                                                                      |
| `packages/amm-sdk/src/constants.ts`                             | Network configs, `DEFAULT_SLIPPAGE_BPS` (50 = 0.5%), `DEFAULT_DEADLINE_OFFSET` (1200s)                                                  |
| `packages/amm-sdk/src/types.ts`                                 | TypeScript interfaces: `Pool`, `SwapEvent`, `LiquidityEvent`, `PriceCandle`, `PoolStats`, `SwapQuote`, `UserPosition`, `CandleInterval` |
| `client/apps/game/src/hooks/use-amm.ts`                         | React hook: creates `AmmClient`, provides `executeSwap`                                                                                 |
| `client/apps/game/src/hooks/store/use-amm-store.ts`             | Zustand store: `selectedPool`, `slippageBps`                                                                                            |
| `client/apps/game/src/ui/features/amm/amm-dashboard.tsx`        | Main AMM dashboard layout                                                                                                               |
| `client/apps/game/src/ui/features/amm/amm-swap.tsx`             | Swap form with routing, quotes, and confirmation                                                                                        |
| `client/apps/game/src/ui/features/amm/amm-model.ts`             | Pure logic: route resolution, pool selection, token options                                                                             |
| `client/apps/game/src/ui/features/amm/amm-add-liquidity.tsx`    | Add liquidity form                                                                                                                      |
| `client/apps/game/src/ui/features/amm/amm-remove-liquidity.tsx` | Remove liquidity form                                                                                                                   |
| `client/apps/game/src/ui/features/amm/amm-pool-list.tsx`        | Pool selector sidebar                                                                                                                   |
| `client/apps/game/src/ui/features/amm/amm-price-chart.tsx`      | OHLCV price chart                                                                                                                       |
| `client/apps/game/src/ui/features/amm/amm-trade-history.tsx`    | Recent swap history table                                                                                                               |
| `client/apps/game/env.ts`                                       | Vite env schema (AMM vars at lines 68-79)                                                                                               |
