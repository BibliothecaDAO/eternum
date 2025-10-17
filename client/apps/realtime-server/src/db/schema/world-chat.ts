import { index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

import type { EntityMetadata, MapLocation } from "../../../../../../common/validation/realtime/shared";
import {
  DISPLAY_NAME_MAX_LENGTH,
  ENTITY_ID_MAX_LENGTH,
  MESSAGE_MAX_LENGTH,
  PLAYER_ID_MAX_LENGTH,
  ZONE_ID_MAX_LENGTH,
} from "../../../../../../common/validation/realtime/shared";

export const worldChatMessages = pgTable(
  "world_chat_messages",
  {
    id: varchar("id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
    zoneId: varchar("zone_id", { length: ZONE_ID_MAX_LENGTH }),
    senderId: varchar("sender_id", { length: PLAYER_ID_MAX_LENGTH }).notNull(),
    senderWallet: varchar("sender_wallet", { length: 68 }),
    senderDisplayName: varchar("sender_display_name", {
      length: DISPLAY_NAME_MAX_LENGTH,
    }),
    senderAvatarUrl: text("sender_avatar_url"),
    content: varchar("content", { length: MESSAGE_MAX_LENGTH }).notNull(),
    location: jsonb("location").$type<MapLocation | null>(),
    metadata: jsonb("metadata").$type<EntityMetadata | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  },
  (table) => ({
    zoneCreatedIndex: index("world_chat_zone_created_idx").on(table.zoneId, table.createdAt),
    senderCreatedIndex: index("world_chat_sender_created_idx").on(table.senderId, table.createdAt),
  }),
);

export type WorldChatMessageRecord = typeof worldChatMessages.$inferSelect;
export type WorldChatMessageInsert = typeof worldChatMessages.$inferInsert;
