import { parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import { isPushOwner } from "./push";

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

export function parseDirectMessageNotificationInput(value: unknown): DirectMessageNotificationInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid_direct_message_notification");
  const input = value as Record<string, unknown>;
  const fields = ["messageId", "threadId", "recipientOwner", "senderDisplayName", "createdAt"];
  if (
    Object.keys(input).some((key) => !fields.includes(key)) ||
    !boundedText(input.messageId, 100) ||
    !boundedText(input.threadId, 200) ||
    !isPushOwner(input.recipientOwner) ||
    (input.senderDisplayName !== undefined && !boundedText(input.senderDisplayName, 64)) ||
    !Number.isSafeInteger(input.createdAt) ||
    (input.createdAt as number) < 0
  )
    throw new Error("invalid_direct_message_notification");
  return input as unknown as DirectMessageNotificationInput;
}

function boundedText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
