import { boolean, index, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { ENTITY_ID_MAX_LENGTH, PLAYER_ID_MAX_LENGTH } from "@bibliothecadao/types";
export const directMessageThreads = pgTable("direct_message_threads", {
    id: varchar("id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
    playerAId: varchar("player_a_id", { length: PLAYER_ID_MAX_LENGTH }).notNull(),
    playerBId: varchar("player_b_id", { length: PLAYER_ID_MAX_LENGTH }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    lastMessageId: varchar("last_message_id", {
        length: ENTITY_ID_MAX_LENGTH,
    }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    unreadCounts: jsonb("unread_counts").$type(),
    metadata: jsonb("metadata").$type(),
}, (table) => ({
    participantIndex: uniqueIndex("direct_message_players_unique").on(table.playerAId, table.playerBId),
}));
export const directMessages = pgTable("direct_messages", {
    id: varchar("id", { length: ENTITY_ID_MAX_LENGTH }).primaryKey(),
    threadId: varchar("thread_id", { length: ENTITY_ID_MAX_LENGTH })
        .notNull()
        .references(() => directMessageThreads.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    senderId: varchar("sender_id", { length: PLAYER_ID_MAX_LENGTH }).notNull(),
    recipientId: varchar("recipient_id", {
        length: PLAYER_ID_MAX_LENGTH,
    }).notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    threadCreatedIndex: index("direct_messages_thread_created_idx").on(table.threadId, table.createdAt),
    senderCreatedIndex: index("direct_messages_sender_created_idx").on(table.senderId, table.createdAt),
}));
export const directMessageReadReceipts = pgTable("direct_message_read_receipts", {
    threadId: varchar("thread_id", { length: ENTITY_ID_MAX_LENGTH })
        .notNull()
        .references(() => directMessageThreads.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    messageId: varchar("message_id", { length: ENTITY_ID_MAX_LENGTH })
        .notNull()
        .references(() => directMessages.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    readerId: varchar("reader_id", { length: PLAYER_ID_MAX_LENGTH }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
    confirmed: boolean("confirmed").default(false).notNull(),
}, (table) => ({
    pk: primaryKey({
        name: "direct_message_read_receipts_pk",
        columns: [table.threadId, table.messageId, table.readerId],
    }),
    threadReaderIndex: index("direct_message_read_receipts_thread_reader_idx").on(table.threadId, table.readerId),
}));
export const directMessageTypingStates = pgTable("direct_message_typing_states", {
    threadId: varchar("thread_id", { length: ENTITY_ID_MAX_LENGTH })
        .notNull()
        .references(() => directMessageThreads.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    playerId: varchar("player_id", { length: PLAYER_ID_MAX_LENGTH }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => ({
    pk: primaryKey({
        name: "direct_message_typing_states_pk",
        columns: [table.threadId, table.playerId],
    }),
    threadIndex: index("direct_message_typing_states_thread_idx").on(table.threadId),
}));
//# sourceMappingURL=direct-messages.js.map