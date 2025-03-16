import { relations, sql } from "drizzle-orm";
import {
  char,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { int8range } from "./int8range";

export const bridgeEventTypeEnum = pgEnum("BridgeEventType", [
  "deposit_initiated_l1",
  "deposit_initiated_l2",
  "withdraw_available_l1",
  "withdraw_completed_l1",
  "withdraw_completed_l2",
]);

export const realmsBridgeRequests = pgTable("realms_bridge_requests", {
  id: text("id").notNull().primaryKey(),
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
    id: text("id").notNull(),
    hash: text("hash").notNull(),
    type: bridgeEventTypeEnum().notNull(),
    timestamp: timestamp("timestamp").notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.type] })],
);
export const realmsBridgeEventsRelations = relations(
  realmsBridgeEvents,
  ({ one }) => ({
    request: one(realmsBridgeRequests, {
      fields: [realmsBridgeEvents.id],
      references: [realmsBridgeRequests.id],
    }),
  }),
);
export const velords_burns = pgTable(
  "dune_velords_burns",
  {
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
    hash: text("hash").notNull(),
    amount: numeric("amount", { scale: 0 }).notNull(),
    recipient: text("recipient").notNull(),
    timestamp: timestamp({ mode: "string" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.amount, t.hash] })],
);

export const governances = pgTable(
  "governances",
  {
    uid: uuid("uid").defaultRandom().primaryKey().notNull(),
    // TODO: failed to parse database type 'int8range'
    //block_range: int8range("block_range").notNull(),
    id: varchar("id", { length: 256 }).notNull(),
    currentDelegates: integer("currentDelegates").notNull(),
    totalDelegates: integer("totalDelegates").notNull(),
    delegatedVotesRaw: numeric("delegatedVotesRaw", {
      precision: 80,
      scale: 0,
    }).notNull(),
    delegatedVotes: numeric("delegatedVotes", {
      precision: 80,
      scale: 20,
    }).notNull(),
  },
  (table) => {
    return {
      currentdelegates_idx: index("governances_currentdelegates_index").using(
        "btree",
        table.currentDelegates,
      ),
      delegatedvotes_idx: index("governances_delegatedvotes_index").using(
        "btree",
        table.delegatedVotes,
      ),
      delegatedvotesraw_idx: index("governances_delegatedvotesraw_index").using(
        "btree",
        table.delegatedVotesRaw,
      ),
      id_idx: index().using("btree", table.id),
      totaldelegates_idx: index("governances_totaldelegates_index").using(
        "btree",
        table.totalDelegates,
      ),
    };
  },
);

export const delegates = pgTable(
  "delegates",
  {
    uid: uuid("uid").defaultRandom().primaryKey().notNull(),
    block_range: int8range("block_range").notNull(),
    id: varchar("id", { length: 256 }).notNull(),
    governance: varchar("governance", { length: 256 }),
    user: varchar("user", { length: 256 }).notNull(),
    delegatedVotesRaw: numeric("delegatedVotesRaw", {
      precision: 80,
      scale: 0,
    }).notNull(),
    delegatedVotes: numeric("delegatedVotes", {
      precision: 80,
      scale: 20,
    }).notNull(),
    tokenHoldersRepresentedAmount: integer(
      "tokenHoldersRepresentedAmount",
    ).notNull(),
    tokenHoldersRepresented: integer("tokenHoldersRepresented").notNull(),
  },
  (table) => {
    return {
      delegatedvotes_idx: index("delegates_delegatedvotes_index").using(
        "btree",
        table.delegatedVotes,
      ),
      delegatedvotesraw_idx: index("delegates_delegatedvotesraw_index").using(
        "btree",
        table.delegatedVotesRaw,
      ),
      governance_idx: index().using("btree", table.governance),
      id_idx: index().using("btree", table.id),
      tokenholdersrepresented_idx: index(
        "delegates_tokenholdersrepresented_index",
      ).using("btree", table.tokenHoldersRepresented),
      tokenholdersrepresentedamount_idx: index(
        "delegates_tokenholdersrepresentedamount_index",
      ).using("btree", table.tokenHoldersRepresentedAmount),
      user_idx: index().using("btree", table.user),
    };
  },
);

export const delegateProfiles = pgTable(
  "delegate_profiles",
  {
    id: varchar("id", { length: 256 })
      .default(sql`gen_random_uuid()`)
      .primaryKey(),
    delegateId: varchar("delegateId", { length: 256 }).unique(),
    statement: text("statement").notNull(),
    interests: text("interests").array(),
    twitter: text("twitter"),
    github: text("github"),
    telegram: text("telegram"),
    discord: text("discord"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", {
      mode: "date",
      withTimezone: true,
    }).$onUpdateFn(() => new Date()),
  },
  (table) => {
    return {
      delegateId_idx: index().using("btree", table.delegateId),
    };
  },
);

export const delegatesRelations = relations(delegates, ({ one }) => ({
  delegateProfile: one(delegateProfiles),
  governance: one(governances),
}));

export const delegateProfilesRelations = relations(
  delegateProfiles,
  ({ one }) => ({
    delegate: one(delegates, {
      fields: [delegateProfiles.delegateId],
      references: [delegates.user],
    }),
  }),
);

export const CreateDelegateProfileSchema = createInsertSchema(
  delegateProfiles,
  {
    statement: z.string(),
    interests: z.string().array().optional(),
    twitter: z.string().optional(),
    github: z.string().optional(),
    telegram: z.string().optional(),
    discord: z.string().optional(),
  },
).omit({
  delegateId: true,
  createdAt: true,
  updatedAt: true,
});

export const reorgRollback = pgTable(
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

export const indexerSchemaVersion = pgTable("__indexer_schema_version", {
  k: integer().primaryKey().notNull(),
  version: integer().notNull(),
});

export const indexerCheckpoints = pgTable("__indexer_checkpoints", {
  id: text().primaryKey().notNull(),
  orderKey: integer("order_key").notNull(),
  uniqueKey: text("unique_key").default("").notNull(),
});

export * from "./auth-schema";
