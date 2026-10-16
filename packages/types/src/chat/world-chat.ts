import * as Schema from "effect/Schema";

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

const worldChatSenderSchema = Schema.Struct({
  playerId: playerIdSchema,
  displayName: Schema.optional(displayNameSchema),
  avatarUrl: Schema.optional(Schema.Trim.check(Schema.makeFilter((value) => URL.canParse(value)))),
});

const worldChatMessageSchema = Schema.Struct({
  id: entityIdSchema,
  sender: worldChatSenderSchema,
  zoneId: zoneIdSchema,
  content: messageContentSchema,
  createdAt: timestampSchema,
  location: Schema.optional(mapLocationSchema),
  metadata: Schema.optional(metadataSchema),
});

export const worldChatPublishSchema = Schema.Struct({
  zoneId: zoneIdSchema,
  content: messageContentSchema,
  location: Schema.optional(mapLocationSchema),
  metadata: Schema.optional(metadataSchema),
});

const worldChatHistoryQuerySchema = Schema.Struct({
  zoneId: zoneIdSchema,
  cursor: Schema.optional(Schema.String),
  limit: Schema.optional(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(MAX_MESSAGE_BATCH)),
  ),
  since: Schema.optional(timestampSchema),
});
export interface WorldChatMessage extends Schema.Schema.Type<typeof worldChatMessageSchema> {}
export interface WorldChatPublishPayload extends Schema.Schema.Type<typeof worldChatPublishSchema> {}
export interface WorldChatHistoryQuery extends Schema.Schema.Type<typeof worldChatHistoryQuerySchema> {}
