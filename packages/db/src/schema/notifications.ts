import { sql } from "drizzle-orm";
import { check, integer, pgTable, text } from "drizzle-orm/pg-core";
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
