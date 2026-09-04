import { boolean, index, integer, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const REALM_OWNERSHIP_INDEXER_ID = "starknet-realms-ownership";

export const starknetRealmOwnership = pgTable(
  "starknet_realm_ownership",
  {
    _id: text("_id").notNull().primaryKey(),
    token_id: numeric("token_id", { scale: 0 }).notNull(),
    owner: text("owner").notNull(),
    block_number: numeric("block_number", { scale: 0 }).notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
  },
  (table) => [index("starknet_realm_ownership_owner_idx").on(table.owner)],
);

export const starknetRealmMetadata = pgTable("starknet_realm_metadata", {
  _id: text("_id").notNull().primaryKey(),
  metadata: text("metadata").notNull(),
});

export const starknetRealmOwnershipStatus = pgTable("starknet_realm_ownership_status", {
  _id: text("_id").notNull().primaryKey(),
  latest_block_number: numeric("latest_block_number", {
    scale: 0,
  }).notNull(),
  latest_block_timestamp: timestamp("latest_block_timestamp", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  last_processed_at: timestamp("last_processed_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  has_reached_head: boolean("has_reached_head").notNull().default(false),
});
