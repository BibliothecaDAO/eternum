import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, index, jsonb, bigint } from "drizzle-orm/pg-core";
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
    gameAlertsSource: text("game_alerts_source"),
    gameAlertsEnabledAt: timestamp("game_alerts_enabled_at", { withTimezone: true }),
    directMessagesEnabledAt: timestamp("direct_messages_enabled_at", { withTimezone: true }),
    gameForegroundUntil: timestamp("game_foreground_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notification_push_owner_idx").on(table.owner)],
);

export const notificationCheckpoints = pgTable("notification_checkpoints", {
  source: text("source").primaryKey(),
  cursor: jsonb("cursor").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: text("id").primaryKey(),
    owner: text("owner")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => notificationPushSubscriptions.id, { onDelete: "cascade" }),
    story: text("story").notNull(),
    notification: jsonb("notification").notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    leaseToken: text("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    outcome: text("outcome"),
  },
  (table) => [
    index("notification_deliveries_due_idx")
      .on(table.availableAt)
      .where(sql`${table.outcome} IS NULL`),
    index("notification_deliveries_expiry_idx").on(table.expiresAt),
    check("notification_delivery_attempts_valid", sql`${table.attempts} >= 0`),
  ],
);
