import { parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import * as Schema from "effect/Schema";
import { decodeNotification, notificationText, pushOwnerSchema } from "./validation";

export interface DirectMessageNotificationInput {
  messageId: string;
  threadId: string;
  recipientOwner: string;
  senderDisplayName?: string;
  createdAt: number;
}

/** Builds a privacy-safe DM alert: sender context is visible, private message text is not. */
export function buildDirectMessageNotification(value: unknown, now: number): LocalNotificationPayload {
  const input = parseDirectMessageNotificationInput(value);
  const sender = input.senderDisplayName ?? "another ruler";
  return parseNotificationPayload(
    {
      version: 1,
      id: `direct-message:${input.messageId}`,
      tag: `direct-thread:${input.threadId}`,
      owner: input.recipientOwner,
      title: `A raven from ${sender}`,
      body: "A private message awaits your reply in Realms.",
      target: "/",
      createdAt: input.createdAt,
      expiresAt: input.createdAt + 120_000,
    },
    now,
  );
}

const directMessageInputSchema = Schema.Struct({
  messageId: notificationText(100),
  threadId: notificationText(200),
  recipientOwner: pushOwnerSchema,
  senderDisplayName: Schema.optional(notificationText(64)),
  createdAt: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export function parseDirectMessageNotificationInput(value: unknown): DirectMessageNotificationInput {
  return decodeNotification(directMessageInputSchema, value, "invalid_direct_message_notification");
}
