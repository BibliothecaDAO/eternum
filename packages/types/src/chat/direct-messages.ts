import * as Schema from "effect/Schema";
import * as Effect from "effect/Effect";

import {
  chatRecordSchema,
  entityIdSchema,
  messageContentSchema,
  metadataSchema,
  playerIdSchema,
  timestampSchema,
} from "./shared";

const dmThreadIdSchema = entityIdSchema;

const directMessageSchema = Schema.Struct({
  id: entityIdSchema,
  threadId: dmThreadIdSchema,
  senderId: playerIdSchema,
  recipientId: playerIdSchema,
  content: messageContentSchema,
  createdAt: timestampSchema,
  metadata: Schema.optional(metadataSchema),
});

export const directMessageCreateSchema = Schema.Struct({
  threadId: Schema.optional(dmThreadIdSchema),
  recipientId: playerIdSchema,
  content: messageContentSchema,
  metadata: Schema.optional(metadataSchema),
});

const unreadCountsSchema = chatRecordSchema
  .check(
    Schema.makeFilter((value) =>
      Object.keys(value).flatMap((key) =>
        Schema.is(playerIdSchema)(key) ? [] : [{ path: [key], issue: "Invalid player id" }],
      ),
    ),
  )
  .pipe(
    Schema.decodeTo(Schema.Record(Schema.String, Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)))),
    Schema.withDecodingDefault(Effect.succeed({})),
  );

const directMessageThreadSchema = Schema.Struct({
  id: dmThreadIdSchema,
  participants: Schema.Array(playerIdSchema)
    .pipe(Schema.mutable)
    .check(Schema.isBetweenLength(2, 2, { message: "Thread must contain exactly two participants." })),
  createdAt: timestampSchema,
  updatedAt: Schema.optional(timestampSchema),
  lastMessageId: Schema.optional(entityIdSchema),
  unreadCounts: unreadCountsSchema,
  typing: Schema.optional(Schema.mutable(Schema.Array(playerIdSchema))),
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

export interface DirectMessage extends Schema.Schema.Type<typeof directMessageSchema> {}
export interface DirectMessageCreatePayload extends Schema.Schema.Type<typeof directMessageCreateSchema> {}
export interface DirectMessageThread extends Schema.Schema.Type<typeof directMessageThreadSchema> {}
export interface DirectMessageTyping extends Schema.Schema.Type<typeof directMessageTypingSchema> {}
export interface DirectMessageReadReceipt extends Schema.Schema.Type<typeof directMessageReadReceiptSchema> {}
