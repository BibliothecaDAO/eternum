import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const playerProfiles = pgTable(
  "player_profiles",
  {
    // Primary key - Cartridge username
    cartridgeUsername: text("cartridge_username").primaryKey(),

    // Player identification
    playerAddress: text("player_address").notNull(),

    // Avatar data
    avatarUrl: text("avatar_url"),
    avatarGenerationPrompt: text("avatar_generation_prompt"),
    falImageId: text("fal_image_id"),

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

    // Rate limiting
    generationCount: integer("generation_count").default(0).notNull(),
    lastGenerationAt: timestamp("last_generation_at", { withTimezone: true }),
  },
  (table) => ({
    playerAddressIndex: index("player_profiles_player_address_idx").on(table.playerAddress),
    createdAtIndex: index("player_profiles_created_at_idx").on(table.createdAt),
  }),
);

export const avatarGenerationLogs = pgTable(
  "avatar_generation_logs",
  {
    id: text("id").primaryKey(),
    cartridgeUsername: text("cartridge_username").notNull(),
    prompt: text("prompt").notNull(),
    falJobId: text("fal_job_id"),
    status: text("status").notNull(), // 'pending', 'processing', 'completed', 'failed'
    errorMessage: text("error_message"),
    imageUrl: text("image_url"),
    imageUrls: jsonb("image_urls").$type<string[] | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cartridgeUsernameIndex: index("avatar_generation_logs_username_idx").on(table.cartridgeUsername),
    createdAtIndex: index("avatar_generation_logs_created_at_idx").on(table.createdAt),
    statusIndex: index("avatar_generation_logs_status_idx").on(table.status),
  }),
);

export type PlayerProfileRecord = typeof playerProfiles.$inferSelect;
export type PlayerProfileInsert = typeof playerProfiles.$inferInsert;
export type AvatarGenerationLogRecord = typeof avatarGenerationLogs.$inferSelect;
export type AvatarGenerationLogInsert = typeof avatarGenerationLogs.$inferInsert;
