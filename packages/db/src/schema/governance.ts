import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { int8range } from "../int8range";

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
