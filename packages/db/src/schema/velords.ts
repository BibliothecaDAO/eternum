import {
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const velords_rewards_received = pgTable(
  "velords_rewards_received",
  {
    //_id: text("_id"),
    sender: text("sender").notNull(),
    amount: numeric("amount").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    //block_time: timestamp("block_time").notNull(),
    timestamp: timestamp("epoch", {
      mode: "date",
      precision: 3,
    }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.amount, t.transaction_hash] })],
);

export const velords_lords_locked = pgTable(
  "velords_lords_locked",
  {
    //_id: text("_id"),
    owner: text("owner").notNull(),
    amount: numeric("amount").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    //block_time: timestamp("block_time").notNull(),
    timestamp: timestamp("epoch", {
      mode: "date",
      precision: 3,
    }).notNull(),
    end_time: timestamp("end_time", { mode: "string" }),
  },
  (t) => [primaryKey({ columns: [t.amount, t.transaction_hash] })],
);
