import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    owner: text("owner")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    level: text("level").notNull().default("off"),
    revision: integer("revision").notNull().default(0),
  },
  (table) => [
    check("notification_level_valid", sql`${table.level} IN ('off', 'important', 'standard', 'all')`),
    check("notification_revision_valid", sql`${table.revision} >= 0`),
  ],
);

export const notificationPushSubscriptions = pgTable(
  "notification_push_subscriptions",
  {
    id: text("id").primaryKey(),
    owner: text("owner")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    revocationHash: text("revocation_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notification_push_owner_idx").on(table.owner)],
);
