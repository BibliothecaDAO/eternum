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
/** A two-player thread as the chat server sends it, with each participant's unread count. */
export interface DirectMessageThread {
  readonly id: string;
  readonly participants: string[];
  readonly createdAt: Date | string;
  readonly updatedAt?: Date | string;
  readonly lastMessageId?: string;
  readonly unreadCounts: Readonly<Record<string, number>>;
  /**
   * The time each participant has read the thread through, as the server keeps it: their unread count is the other
   * player's messages after it. Absent for one who never read.
   */
  readonly readThrough?: Readonly<Record<string, Date | string>>;
  readonly typing?: string[];
}
export interface DirectMessageTyping extends Schema.Schema.Type<typeof directMessageTypingSchema> {}
export interface DirectMessageReadReceipt extends Schema.Schema.Type<typeof directMessageReadReceiptSchema> {}
