import {
  bigint,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const factories = pgTable(
  "factories",
  {
    factoryAddress: text("factory_address").primaryKey(),
    feeTo: text("fee_to").notNull().default("0x0"),
    feeAmount: numeric("fee_amount", { precision: 78, scale: 0 }).notNull().default("997"),
    pairCount: bigint("pair_count", { mode: "bigint" }).notNull().default(0n),
    lastUpdatedBlockNumber: bigint("last_updated_block_number", { mode: "bigint" }).notNull().default(0n),
    lastUpdatedTxHash: text("last_updated_tx_hash").notNull().default("0x0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table: any) => [index("factories_updated_idx").on(table.lastUpdatedBlockNumber)],
);

export const pairs = pgTable(
  "pairs",
  {
    pairAddress: text("pair_address").primaryKey(),
    factoryAddress: text("factory_address").notNull(),
    token0Address: text("token0_address").notNull(),
    token1Address: text("token1_address").notNull(),
    lpTokenAddress: text("lp_token_address").notNull(),
    reserve0: numeric("reserve0", { precision: 78, scale: 0 }).notNull().default("0"),
    reserve1: numeric("reserve1", { precision: 78, scale: 0 }).notNull().default("0"),
    totalLpSupply: numeric("total_lp_supply", { precision: 78, scale: 0 }).notNull().default("0"),
    createdBlockNumber: bigint("created_block_number", { mode: "bigint" }).notNull().default(0n),
    createdTxHash: text("created_tx_hash").notNull().default("0x0"),
    lastSyncedBlockNumber: bigint("last_synced_block_number", { mode: "bigint" }).notNull().default(0n),
    lastSyncedTxHash: text("last_synced_tx_hash").notNull().default("0x0"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table: any) => [
    index("pairs_factory_idx").on(table.factoryAddress),
    index("pairs_token0_idx").on(table.token0Address),
    index("pairs_token1_idx").on(table.token1Address),
  ],
);

export const factoryFeeChanges = pgTable(
  "factory_fee_changes",
  {
    id: text("id").primaryKey(),
    factoryAddress: text("factory_address").notNull(),
    changeType: text("change_type").notNull(),
    oldFeeTo: text("old_fee_to"),
    newFeeTo: text("new_fee_to"),
    oldFeeAmount: numeric("old_fee_amount", { precision: 78, scale: 0 }),
    newFeeAmount: numeric("new_fee_amount", { precision: 78, scale: 0 }),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
    txHash: text("tx_hash").notNull(),
  },
  (table: any) => [index("factory_fee_changes_factory_idx").on(table.factoryAddress, table.blockTimestamp)],
);

export const pairSwaps = pgTable(
  "pair_swaps",
  {
    id: text("id").primaryKey(),
    pairAddress: text("pair_address").notNull(),
    factoryAddress: text("factory_address").notNull(),
    token0Address: text("token0_address").notNull(),
    token1Address: text("token1_address").notNull(),
    initiatorAddress: text("initiator_address").notNull(),
    callerAddress: text("caller_address").notNull(),
    recipientAddress: text("recipient_address").notNull(),
    amount0In: numeric("amount0_in", { precision: 78, scale: 0 }).notNull(),
    amount1In: numeric("amount1_in", { precision: 78, scale: 0 }).notNull(),
    amount0Out: numeric("amount0_out", { precision: 78, scale: 0 }).notNull(),
    amount1Out: numeric("amount1_out", { precision: 78, scale: 0 }).notNull(),
    feeAmount: numeric("fee_amount", { precision: 78, scale: 0 }).notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
    txHash: text("tx_hash").notNull(),
    eventIndex: integer("event_index").notNull(),
  },
  (table: any) => [
    index("pair_swaps_pair_idx").on(table.pairAddress, table.blockTimestamp),
    index("pair_swaps_initiator_idx").on(table.initiatorAddress),
  ],
);

export const pairLiquidityEvents = pgTable(
  "pair_liquidity_events",
  {
    id: text("id").primaryKey(),
    pairAddress: text("pair_address").notNull(),
    factoryAddress: text("factory_address").notNull(),
    token0Address: text("token0_address").notNull(),
    token1Address: text("token1_address").notNull(),
    providerAddress: text("provider_address").notNull(),
    eventType: text("event_type").notNull(),
    amount0: numeric("amount0", { precision: 78, scale: 0 }).notNull(),
    amount1: numeric("amount1", { precision: 78, scale: 0 }).notNull(),
    lpAmount: numeric("lp_amount", { precision: 78, scale: 0 }).notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
    txHash: text("tx_hash").notNull(),
    eventIndex: integer("event_index").notNull(),
  },
  (table: any) => [
    index("pair_liquidity_pair_idx").on(table.pairAddress, table.blockTimestamp),
    index("pair_liquidity_provider_idx").on(table.providerAddress),
  ],
);

export const pairLpTransfers = pgTable(
  "pair_lp_transfers",
  {
    id: text("id").primaryKey(),
    pairAddress: text("pair_address").notNull(),
    factoryAddress: text("factory_address").notNull(),
    token0Address: text("token0_address").notNull(),
    token1Address: text("token1_address").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
    txHash: text("tx_hash").notNull(),
    eventIndex: integer("event_index").notNull(),
  },
  (table: any) => [
    index("pair_lp_transfers_pair_idx").on(table.pairAddress, table.blockTimestamp),
    index("pair_lp_transfers_from_idx").on(table.fromAddress),
    index("pair_lp_transfers_to_idx").on(table.toAddress),
  ],
);

export const pairLpBalances = pgTable(
  "pair_lp_balances",
  {
    id: text("id").notNull(),
    pairAddress: text("pair_address").notNull(),
    ownerAddress: text("owner_address").notNull(),
    balance: numeric("balance", { precision: 78, scale: 0 }).notNull().default("0"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table: any) => [
    primaryKey({ columns: [table.pairAddress, table.ownerAddress], name: "pair_lp_balances_pk" }),
    uniqueIndex("pair_lp_balances_id_idx").on(table.id),
    index("pair_lp_balances_owner_idx").on(table.ownerAddress),
    index("pair_lp_balances_pair_idx").on(table.pairAddress),
  ],
);

export const pairPriceCandles = pgTable(
  "pair_price_candles",
  {
    id: text("id").primaryKey(),
    pairAddress: text("pair_address").notNull(),
    interval: text("interval").notNull(),
    openTime: timestamp("open_time").notNull(),
    closeTime: timestamp("close_time").notNull(),
    open: numeric("open", { precision: 40, scale: 18 }).notNull(),
    high: numeric("high", { precision: 40, scale: 18 }).notNull(),
    low: numeric("low", { precision: 40, scale: 18 }).notNull(),
    close: numeric("close", { precision: 40, scale: 18 }).notNull(),
    volume0: numeric("volume0", { precision: 78, scale: 0 }).notNull().default("0"),
    volume1: numeric("volume1", { precision: 78, scale: 0 }).notNull().default("0"),
    tradeCount: integer("trade_count").notNull().default(0),
  },
  (table: any) => [index("pair_price_candles_pair_idx").on(table.pairAddress, table.interval, table.openTime)],
);
