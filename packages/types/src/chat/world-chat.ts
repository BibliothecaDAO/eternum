import { z } from "zod";

import {
  displayNameSchema,
  entityIdSchema,
  mapLocationSchema,
  messageContentSchema,
  metadataSchema,
  playerIdSchema,
  timestampSchema,
  zoneIdSchema,
} from "./shared";

const MAX_MESSAGE_BATCH = 100;

export const GLOBAL_CHAT_CHANNEL_ID = "world:global";

const worldChatSenderSchema = z.object({
  playerId: playerIdSchema,
  displayName: displayNameSchema.optional(),
  avatarUrl: z.string().url().optional(),
});

const worldChatMessageSchema = z.object({
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

const worldChatHistoryQuerySchema = z.object({
  zoneId: zoneIdSchema,
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_MESSAGE_BATCH).optional(),
  since: timestampSchema.optional(),
});
export interface WorldChatMessage extends z.infer<typeof worldChatMessageSchema> {}
export interface WorldChatPublishPayload extends z.infer<typeof worldChatPublishSchema> {}
export interface WorldChatHistoryQuery extends z.infer<typeof worldChatHistoryQuerySchema> {}
