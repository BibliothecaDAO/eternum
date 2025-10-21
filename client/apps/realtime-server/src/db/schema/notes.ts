import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

import type { EntityMetadata, MapLocation } from "@bibliothecadao/types";
import {
  ENTITY_ID_MAX_LENGTH,
  MESSAGE_MAX_LENGTH,
  noteSchema,
  PLAYER_ID_MAX_LENGTH,
  ZONE_ID_MAX_LENGTH,
} from "@bibliothecadao/types";

export const noteVisibilityEnum = pgEnum("note_visibility", ["public", "private"]);

export const notes = pgTable(
  "notes",
  {
    id: varchar("id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
    authorId: varchar("author_id", { length: PLAYER_ID_MAX_LENGTH }).notNull(),
    zoneId: varchar("zone_id", { length: ZONE_ID_MAX_LENGTH }).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    content: varchar("content", { length: MESSAGE_MAX_LENGTH }).notNull(),
    location: jsonb("location")
      .$type<MapLocation>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    visibility: noteVisibilityEnum("visibility").default("public").notNull(),
    metadata: jsonb("metadata").$type<EntityMetadata | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => ({
    zoneCreatedIndex: index("notes_zone_created_idx").on(table.zoneId, table.createdAt),
    authorCreatedIndex: index("notes_author_created_idx").on(table.authorId, table.createdAt),
  }),
);

export type Note = typeof notes.$inferSelect;
export type NoteInsert = typeof notes.$inferInsert;

export const noteValidator = noteSchema;
