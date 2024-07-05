import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
  discord: text("discord"),
  telegram: text("telegram"),
});
