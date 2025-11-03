import { z } from "zod";

import {
  displayNameSchema,
  entityIdSchema,
  mapLocationSchema,
  messageContentSchema,
  metadataSchema,
  playerIdSchema,
  starknetAddressSchema,
  timestampSchema,
  zoneIdSchema,
} from "./shared";

const MAX_MESSAGE_BATCH = 100;

export const worldChatSenderSchema = z.object({
  playerId: playerIdSchema,
  walletAddress: starknetAddressSchema.optional(),
  displayName: displayNameSchema.optional(),
  avatarUrl: z.string().url().optional(),
});

export const worldChatMessageSchema = z.object({
  id: entityIdSchema,
  sender: worldChatSenderSchema,
  zoneId: zoneIdSchema,
  content: messageContentSchema,
  createdAt: timestampSchema,
  location: mapLocationSchema.optional(),
  metadata: metadataSchema.optional(),
});

export const worldChatPublishSchema = z.object({
  zoneId: zoneIdSchema,
  content: messageContentSchema,
  location: mapLocationSchema.optional(),
  metadata: metadataSchema.optional(),
});

export const worldChatHistoryQuerySchema = z.object({
  zoneId: zoneIdSchema.optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_MESSAGE_BATCH).optional(),
  since: timestampSchema.optional(),
});

export const worldChatAckSchema = z.object({
  id: entityIdSchema,
  deliveredAt: timestampSchema,
});

export interface WorldChatSender extends z.infer<typeof worldChatSenderSchema> {}
export interface WorldChatMessage extends z.infer<typeof worldChatMessageSchema> {}
export interface WorldChatPublishPayload extends z.infer<typeof worldChatPublishSchema> {}
export interface WorldChatHistoryQuery extends z.infer<typeof worldChatHistoryQuerySchema> {}
export interface WorldChatAck extends z.infer<typeof worldChatAckSchema> {}
