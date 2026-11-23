import * as Schema from "effect/Schema";

import { mapLocationSchema, messageContentSchema, metadataSchema, zoneIdSchema } from "./shared";

export const GLOBAL_CHAT_CHANNEL_ID = "world:global";

const ASPECT_CHAT_ROOM = /^aspect:(0x[0-9a-f]{1,64}):([1-9][0-9]{0,9}):([0-9]{1,3})$/;

export const aspectChatRoom = (
  chainId: string,
  gameId: number,
  aspect: number,
): `aspect:${string}:${number}:${number}` => `aspect:0x${BigInt(chainId).toString(16)}:${gameId}:${aspect}`;

export const parseAspectChatRoom = (zoneId: string): { chainId: string; gameId: number; aspect: number } | null => {
  const match = ASPECT_CHAT_ROOM.exec(zoneId);
  return match ? { chainId: match[1]!, gameId: Number(match[2]), aspect: Number(match[3]) } : null;
};

export const worldChatPublishSchema = Schema.Struct({
  zoneId: zoneIdSchema,
  content: messageContentSchema,
  location: Schema.optional(mapLocationSchema),
  metadata: Schema.optional(metadataSchema),
});

/** A world-chat message as the chat server sends it. */
export interface WorldChatMessage {
  readonly id: string;
  readonly sender: { readonly playerId: string; readonly displayName?: string };
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
