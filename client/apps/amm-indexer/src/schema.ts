import {
  pgTable,
  uuid,
  text,
  numeric,
  bigint,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ============ Pools — current pool state ============

export const pools = pgTable(
  "pools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenAddress: text("token_address").notNull(),
    lpTokenAddress: text("lp_token_address").notNull(),
    lordsReserve: numeric("lords_reserve", { precision: 78, scale: 0 })
      .notNull()
      .default("0"),
    tokenReserve: numeric("token_reserve", { precision: 78, scale: 0 })
      .notNull()
      .default("0"),
    totalLpSupply: numeric("total_lp_supply", { precision: 78, scale: 0 })
      .notNull()
      .default("0"),
    lpFeeNum: numeric("lp_fee_num", { precision: 78, scale: 0 }).notNull(),
    lpFeeDenom: numeric("lp_fee_denom", { precision: 78, scale: 0 }).notNull(),
    protocolFeeNum: numeric("protocol_fee_num", {
      precision: 78,
      scale: 0,
    }).notNull(),
    protocolFeeDenom: numeric("protocol_fee_denom", {
      precision: 78,
      scale: 0,
    }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    txHash: text("tx_hash").notNull(),
  },
  (table) => [uniqueIndex("pools_token_address_idx").on(table.tokenAddress)],
);

// ============ Swaps — every trade ============

export const swaps = pgTable(
  "swaps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenAddress: text("token_address").notNull(),
    userAddress: text("user_address").notNull(),
    tokenIn: text("token_in").notNull(),
    tokenOut: text("token_out").notNull(),
    amountIn: numeric("amount_in", { precision: 78, scale: 0 }).notNull(),
    amountOut: numeric("amount_out", { precision: 78, scale: 0 }).notNull(),
    protocolFee: numeric("protocol_fee", { precision: 78, scale: 0 }).notNull(),
    priceBeforeSwap: numeric("price_before_swap", {
      precision: 40,
      scale: 18,
    }),
    priceAfterSwap: numeric("price_after_swap", { precision: 40, scale: 18 }),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
    txHash: text("tx_hash").notNull(),
    eventIndex: integer("event_index").notNull(),
  },
  (table) => [
    index("swaps_token_address_idx").on(table.tokenAddress),
    index("swaps_user_address_idx").on(table.userAddress),
    index("swaps_block_timestamp_idx").on(table.blockTimestamp),
  ],
);

// ============ Liquidity Events — every add/remove ============

export const liquidityEvents = pgTable(
  "liquidity_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenAddress: text("token_address").notNull(),
    providerAddress: text("provider_address").notNull(),
    eventType: text("event_type").notNull(), // "add" or "remove"
    lordsAmount: numeric("lords_amount", { precision: 78, scale: 0 }).notNull(),
    tokenAmount: numeric("token_amount", { precision: 78, scale: 0 }).notNull(),
    lpAmount: numeric("lp_amount", { precision: 78, scale: 0 }).notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
    txHash: text("tx_hash").notNull(),
    eventIndex: integer("event_index").notNull(),
  },
  (table) => [
    index("liquidity_events_token_address_idx").on(table.tokenAddress),
    index("liquidity_events_provider_address_idx").on(table.providerAddress),
    index("liquidity_events_block_timestamp_idx").on(table.blockTimestamp),
  ],
);

// ============ Pool Fee Changes — admin fee changes ============

export const poolFeeChanges = pgTable("pool_fee_changes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenAddress: text("token_address").notNull(),
  lpFeeNum: numeric("lp_fee_num", { precision: 78, scale: 0 }).notNull(),
  lpFeeDenom: numeric("lp_fee_denom", { precision: 78, scale: 0 }).notNull(),
  protocolFeeNum: numeric("protocol_fee_num", {
    precision: 78,
    scale: 0,
  }).notNull(),
  protocolFeeDenom: numeric("protocol_fee_denom", {
    precision: 78,
    scale: 0,
  }).notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  blockTimestamp: timestamp("block_timestamp").notNull(),
  txHash: text("tx_hash").notNull(),
});

// ============ Price Candles — OHLCV ============

export const priceCandles = pgTable(
  "price_candles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenAddress: text("token_address").notNull(),
    interval: text("interval").notNull(), // "1m", "5m", "15m", "1h", "4h", "1d"
    openTime: timestamp("open_time").notNull(),
    closeTime: timestamp("close_time").notNull(),
    open: numeric("open", { precision: 40, scale: 18 }).notNull(),
    high: numeric("high", { precision: 40, scale: 18 }).notNull(),
    low: numeric("low", { precision: 40, scale: 18 }).notNull(),
    close: numeric("close", { precision: 40, scale: 18 }).notNull(),
    volume: numeric("volume", { precision: 78, scale: 0 })
      .notNull()
      .default("0"),
    tradeCount: integer("trade_count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("price_candles_unique_idx").on(
      table.tokenAddress,
      table.interval,
      table.openTime,
    ),
  ],
);

// ============ Pool Snapshots — periodic snapshots ============

export const poolSnapshots = pgTable(
  "pool_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenAddress: text("token_address").notNull(),
    lordsReserve: numeric("lords_reserve", { precision: 78, scale: 0 }).notNull(),
    tokenReserve: numeric("token_reserve", { precision: 78, scale: 0 }).notNull(),
    totalLpSupply: numeric("total_lp_supply", {
      precision: 78,
      scale: 0,
    }).notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
  },
  (table) => [
    index("pool_snapshots_token_timestamp_idx").on(
      table.tokenAddress,
      table.blockTimestamp,
    ),
  ],
);
