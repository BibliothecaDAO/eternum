import * as Schema from "effect/Schema";

import { mapLocationSchema, messageContentSchema, metadataSchema, zoneIdSchema } from "./shared";

export const GLOBAL_CHAT_CHANNEL_ID = "world:global";

export const worldChatPublishSchema = Schema.Struct({
  zoneId: zoneIdSchema,
  content: messageContentSchema,
  location: Schema.optional(mapLocationSchema),
  metadata: Schema.optional(metadataSchema),
});

/** A world-chat message as the chat server sends it. */
export interface WorldChatMessage {
  readonly id: string;
  readonly sender: { readonly playerId: string; readonly displayName?: string; readonly avatarUrl?: string };
  readonly zoneId: string;
  readonly content: string;
  readonly createdAt: Date | string;
  readonly location?: { readonly x: number; readonly y: number; readonly z?: number };
  readonly metadata?: Readonly<Record<string, unknown>>;
}
export interface WorldChatPublishPayload extends Schema.Schema.Type<typeof worldChatPublishSchema> {}
/** A request for a page of a zone's world-chat history. */
export interface WorldChatHistoryQuery {
  readonly zoneId: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly since?: Date | string;
}
