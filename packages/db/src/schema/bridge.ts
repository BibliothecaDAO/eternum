import { relations } from "drizzle-orm";
import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,

} from "drizzle-orm/pg-core";

export const bridgeEventTypeEnum = pgEnum("BridgeEventType", [
  "deposit_initiated_l1",
  "deposit_initiated_l2",
  "withdraw_available_l1",
  "withdraw_completed_l1",
  "withdraw_completed_l2",
]);

export const realmsBridgeRequests = pgTable("realms_bridge_requests", {
  _id: text("_id").notNull().primaryKey(),
  from_chain: text("from_chain").notNull(),
  token_ids: integer("token_ids").array().notNull(),
  from_address: text("from_address").notNull(),
  to_address: text("to_address").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  tx_hash: text("tx_hash").notNull(),
  req_hash: numeric("req_hash").notNull(),
});

export const realmsBridgeRequestsRelations = relations(
  realmsBridgeRequests,
  ({ many }) => ({
    events: many(realmsBridgeEvents),
  }),
);
export const realmsBridgeEvents = pgTable(
  "realms_bridge_events",
  {
    _id: text("_id").notNull(),
    hash: text("hash").notNull(),
    type: bridgeEventTypeEnum().notNull(),
    timestamp: timestamp("timestamp").notNull(),
  },
  (t) => [primaryKey({ columns: [t._id, t.type] })],
);
export const realmsBridgeEventsRelations = relations(
  realmsBridgeEvents,
  ({ one }) => ({
    request: one(realmsBridgeRequests, {
      fields: [realmsBridgeEvents._id],
      references: [realmsBridgeRequests._id],
    }),
  }),
);
export const velords_burns = pgTable(
  "dune_velords_burns",
  {
    _id: text("_id"),
    source: text("source").notNull(),
    amount: numeric("amount").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    //block_time: timestamp("block_time").notNull(),
    epoch: timestamp("epoch", {
      mode: "date",
      precision: 3,
    }).notNull(),
    epoch_total_amount: numeric("epoch_total_amount").notNull(),
    sender_epoch_total_amount: numeric("sender_epoch_total_amount").notNull(),
  },
  (t) => [primaryKey({ columns: [t.amount, t.transaction_hash] })],
);

export const velords_supply = pgTable("dune_velords_supply", {
  _id: text("_id"),
  old_supply: text("old_supply").notNull(),
  new_supply: numeric("new_supply").notNull(),
  transaction_hash: text("transaction_hash").notNull().primaryKey(),
  block_time: timestamp("block_time", {
    mode: "date",
    precision: 3,
  }).notNull(),
});

export const realmsLordsClaims = pgTable(
  "realms_lords_claims",
  {
    _id: text("_id"),
    hash: text("hash").notNull(),
    amount: numeric("amount", { scale: 0 }).notNull(),
    recipient: text("recipient").notNull(),
    timestamp: timestamp({ mode: "string" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.amount, t.hash] })],
);


/* UNCOMMENT THIS TO PUSH TO DB*/

/*export const reorgRollback = pgTable(
  "__reorg_rollback",
  {
    n: serial().primaryKey().notNull(),
    op: char({ length: 1 }).notNull(),
    tableName: text("table_name").notNull(),
    cursor: integer().notNull(),
    rowId: text("row_id"),
    rowValue: jsonb("row_value"),
    indexerId: text("indexer_id").notNull(),
  },
  (table) => [
    index("idx_reorg_rollback_indexer_id_cursor").using(
      "btree",
      table.indexerId.asc().nullsLast().op("int4_ops"),
      table.cursor.asc().nullsLast().op("int4_ops"),
    ),
  ],
);
export const indexerFilters = pgTable(
  "__indexer_filters",
  {
    id: text().notNull(),
    filter: text().notNull(),
    fromBlock: integer("from_block").notNull(),
    toBlock: integer("to_block"),
  },
  (table) => [
    primaryKey({
      columns: [table.id, table.fromBlock],
      name: "__indexer_filters_pkey",
    }),
  ],
);

export const indexerSchemaVersion = pgTable("__indexer_schema_version", {
  k: integer().primaryKey().notNull(),
  version: integer().notNull(),
});

export const indexerCheckpoints = pgTable("__indexer_checkpoints", {
  id: text().primaryKey().notNull(),
  orderKey: integer("order_key").notNull(),
  uniqueKey: text("unique_key").default("").notNull(),
});
*/