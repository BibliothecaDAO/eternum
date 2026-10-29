import * as Schema from "effect/Schema";

import { CHAT_PATH, lobbyPath, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import { decodeNotification, notificationText, pushOwnerSchema } from "./validation";

/** Where a mention was written: Global, or a Blitz slot's lobby room, by the slot's name. */
export type MentionPlace = { kind: "global" } | { kind: "lobby"; slot: string };

export interface MentionNotificationInput {
  messageId: string;
  recipientOwner: string;
  senderDisplayName?: string;
  place: MentionPlace;
  createdAt: number;
}

/**
 * A mention's alert: who mentioned the player and where, never the message, as a private message's alert; pressed,
 * it opens that chat (the app's chat page for Global, the lobby for its room). One alert per room: a newer mention there
 * takes the older one's place.
 */
export function buildMentionNotification(value: unknown, now: number): LocalNotificationPayload {
  const input = decodeNotification(mentionInputSchema, value, "invalid_mention_notification");
  const sender = input.senderDisplayName ?? "Another player";
  const lobby = input.place.kind === "lobby";
  return parseNotificationPayload(
    {
      version: 1,
      id: `mention:${input.messageId}`,
      tag: lobby ? `mention:lobby:${input.place.slot}` : "mention:global",
      owner: input.recipientOwner,
      title: `${sender} mentioned you`,
      body: lobby ? "In a Blitz lobby. Open Realms to read it." : "In Global. Open Realms to read it.",
      target: input.place.kind === "lobby" ? lobbyPath(input.place.slot) : CHAT_PATH,
      createdAt: input.createdAt,
      expiresAt: input.createdAt + 120_000,
    },
    now,
  );
}

const mentionInputSchema = Schema.Struct({
  messageId: notificationText(100),
  recipientOwner: pushOwnerSchema,
  senderDisplayName: Schema.optional(notificationText(64)),
  place: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("global") }),
    Schema.Struct({ kind: Schema.Literal("lobby"), slot: notificationText(24) }),
  ]),
  createdAt: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});
