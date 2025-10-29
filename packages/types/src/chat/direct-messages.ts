import { z } from "zod";

import { entityIdSchema, messageContentSchema, metadataSchema, playerIdSchema, timestampSchema } from "./shared";

const MAX_DM_BATCH = 100;

export const dmThreadIdSchema = entityIdSchema;

export const directMessageSchema = z.object({
  id: entityIdSchema,
  threadId: dmThreadIdSchema,
  senderId: playerIdSchema,
  recipientId: playerIdSchema,
  content: messageContentSchema,
  createdAt: timestampSchema,
  metadata: metadataSchema.optional(),
});

export const directMessageCreateSchema = z.object({
  threadId: dmThreadIdSchema.optional(),
  recipientId: playerIdSchema,
  content: messageContentSchema,
  metadata: metadataSchema.optional(),
});

export const directMessageThreadSchema = z.object({
  id: dmThreadIdSchema,
  participants: z.array(playerIdSchema).length(2, "Thread must contain exactly two participants."),
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
  lastMessageId: entityIdSchema.optional(),
  unreadCounts: z.record(playerIdSchema, z.number().int().min(0)).default({}),
  typing: z.array(playerIdSchema).optional(),
});

export const directMessageThreadQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_DM_BATCH).optional(),
  since: timestampSchema.optional(),
});

export const directMessageHistoryQuerySchema = z.object({
  threadId: dmThreadIdSchema,
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_DM_BATCH).optional(),
  since: timestampSchema.optional(),
});

export const directMessageTypingSchema = z.object({
  threadId: dmThreadIdSchema,
  playerId: playerIdSchema,
  isTyping: z.boolean(),
});

export const directMessageReadReceiptSchema = z.object({
  threadId: dmThreadIdSchema,
  messageId: entityIdSchema,
  readerId: playerIdSchema,
  readAt: timestampSchema,
});

export interface DirectMessage extends z.infer<typeof directMessageSchema> {}
export interface DirectMessageCreatePayload extends z.infer<typeof directMessageCreateSchema> {}
export interface DirectMessageThread extends z.infer<typeof directMessageThreadSchema> {}
export interface DirectMessageThreadQuery extends z.infer<typeof directMessageThreadQuerySchema> {}
export interface DirectMessageHistoryQuery extends z.infer<typeof directMessageHistoryQuerySchema> {}
export interface DirectMessageTyping extends z.infer<typeof directMessageTypingSchema> {}
export interface DirectMessageReadReceipt extends z.infer<typeof directMessageReadReceiptSchema> {}
