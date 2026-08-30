import { index, integer, numeric, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * MMRUpdated events from the mainnet MMRToken, written by the apibara indexer.
 * These are immutable L2 history; the token contract stays the truth for a
 * player's current rating. The leaderboard derives its population and game
 * counts from these rows and reads live ratings from the contract.
 */
export const starknet_mmr_updates = pgTable(
  "starknet_mmr_updates",
  {
    player: text("player").notNull(),
    new_mmr: numeric("new_mmr").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    block_number: integer("block_number").notNull(),
    timestamp: timestamp("timestamp", { mode: "date", precision: 3 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.transaction_hash, t.event_index] }), index("mmr_updates_player_idx").on(t.player)],
);
