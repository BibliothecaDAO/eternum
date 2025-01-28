import { relations } from "drizzle-orm";
import {
  bigint,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const bridgeEventTypeEnum = pgEnum("BridgeEventType", [
  "deposit_initiated_l1",
  "deposit_initiated_l2",
  "withdraw_available_l1",
  "withdraw_completed_l1",
  "withdraw_completed_l2",
]);

export const starknetUsdcTransfers = pgTable("starknet_usdc_transfers", {
  _id: uuid("_id").primaryKey().defaultRandom(),
  number: bigint("number", { mode: "number" }),
  hash: text("hash"),
});

export const ethereumUsdcTransfers = pgTable("ethereum_usdc_transfers", {
  _id: uuid("_id").primaryKey().defaultRandom(),
  number: bigint("number", { mode: "number" }),
  hash: text("hash"),
});

export const realmsBridgeEvents = pgTable("realms_bridge_events", {
  payload: jsonb("payload"),
  hash: text("hash"),
  type: bridgeEventTypeEnum().notNull(),
});

export const realmsBridgeRequests = pgTable("realms_bridge_requests", {
  from_chain: text("from_chain").notNull(),
  token_ids: integer("token_ids").array().notNull(),
  from_address: text("from_address").notNull(),
  to_address: text("to_address").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  hash: text("hash").notNull(),
});

export const realmsBridgeRequestsRelations = relations(
  realmsBridgeEvents,
  ({ many }) => ({
    realmsBridgeEvents: many(realmsBridgeEvents),
  }),
);