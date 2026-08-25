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
