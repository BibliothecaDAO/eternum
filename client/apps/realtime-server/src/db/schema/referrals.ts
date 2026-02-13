import { bigint, boolean, index, integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { DISPLAY_NAME_MAX_LENGTH, ENTITY_ID_MAX_LENGTH } from "@bibliothecadao/types";

const STARKNET_ADDRESS_MAX_LENGTH = 66;

export const referrals = pgTable(
  "referrals",
  {
    id: varchar("id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
    refereeAddress: varchar("referee_address", { length: STARKNET_ADDRESS_MAX_LENGTH }).notNull(),
    referrerAddress: varchar("referrer_address", { length: STARKNET_ADDRESS_MAX_LENGTH }).notNull(),
    refereeUsername: varchar("referee_username", { length: DISPLAY_NAME_MAX_LENGTH }),
    referrerUsername: varchar("referrer_username", { length: DISPLAY_NAME_MAX_LENGTH }),
    source: varchar("source", { length: 32 }).notNull().default("unknown"),
    hasPlayed: boolean("has_played").notNull().default(false),
    gamesPlayed: integer("games_played").notNull().default(0),
    lastCheckedBlock: bigint("last_checked_block", { mode: "number" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    refereeAddressUnique: uniqueIndex("referrals_referee_address_unique").on(table.refereeAddress),
    referrerAddressIndex: index("referrals_referrer_address_idx").on(table.referrerAddress),
    verifiedIndex: index("referrals_verified_idx").on(table.hasPlayed, table.gamesPlayed),
  }),
);

export type ReferralRecord = typeof referrals.$inferSelect;
export type ReferralInsert = typeof referrals.$inferInsert;
