import {
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const velords_burns = pgTable(
  "dune_velords_burns",
  {
    //_id: text("_id"),
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
  //_id: text("_id"),
  old_supply: text("old_supply").notNull(),
  new_supply: numeric("new_supply").notNull(),
  transaction_hash: text("transaction_hash").notNull().primaryKey(),
  block_time: timestamp("block_time", {
    mode: "date",
    precision: 3,
  }).notNull(),
});
