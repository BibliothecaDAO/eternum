import * as Schema from "effect/Schema";

import { entityIdSchema, messageContentSchema, metadataSchema, playerIdSchema, timestampSchema } from "./shared";

const dmThreadIdSchema = entityIdSchema;

export const directMessageCreateSchema = Schema.Struct({
  threadId: Schema.optional(dmThreadIdSchema),
  recipientId: playerIdSchema,
  content: messageContentSchema,
  metadata: Schema.optional(metadataSchema),
});

export const directMessageTypingSchema = Schema.Struct({
  threadId: dmThreadIdSchema,
  playerId: playerIdSchema,
  isTyping: Schema.Boolean,
});

export const directMessageReadReceiptSchema = Schema.Struct({
  threadId: dmThreadIdSchema,
  messageId: entityIdSchema,
  readerId: playerIdSchema,
  readAt: timestampSchema,
});

/** A direct message as the chat server sends it. */
export interface DirectMessage {
  readonly id: string;
  readonly threadId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly content: string;
  readonly createdAt: Date | string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
export interface DirectMessageCreatePayload extends Schema.Schema.Type<typeof directMessageCreateSchema> {}
/**
 * A two-player thread as the chat server sends it, with the receiving participant's unread count: the only count of
 * what that player has not read, kept by their inbox from its own copy of every message.
 */
export interface DirectMessageThread {
  readonly id: string;
  readonly participants: string[];
  readonly createdAt: Date | string;
  readonly updatedAt?: Date | string;
  readonly lastMessageId?: string;
  readonly unreadCounts: Readonly<Record<string, number>>;
  readonly typing?: string[];
}
export interface DirectMessageTyping extends Schema.Schema.Type<typeof directMessageTypingSchema> {}
export interface DirectMessageReadReceipt extends Schema.Schema.Type<typeof directMessageReadReceiptSchema> {}

/**
 * An account's block list as its inbox holds it, with its version: the version rises with each change, so of two
 * answers the one with the higher version is the later list, whatever order they arrive in. Every reply of
 * /api/chat/blocks (a read, a block, an unblock) is one.
 */
const blockListSchema = Schema.Struct({
  blocked: Schema.Array(playerIdSchema),
  version: Schema.Number,
});

export interface BlockList extends Schema.Schema.Type<typeof blockListSchema> {}

export const isBlockList = Schema.is(blockListSchema);
