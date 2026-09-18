import type { DirectMessageRecord } from "../db/schema/direct-messages";
import type { PlayerSession } from "../http/middleware/auth";

export interface DirectMessageNotificationPublisher {
  publish(input: {
    messageId: string;
    threadId: string;
    recipientOwner: string;
    senderDisplayName?: string;
    createdAt: number;
  }): Promise<void>;
}

export type DirectMessageNotificationFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export const DISABLED_DIRECT_MESSAGE_NOTIFICATIONS: DirectMessageNotificationPublisher = {
  publish: () => Promise.resolve(),
};

export function createDirectMessageNotificationPublisher({
  identityUrl,
  secret,
  fetch: send = globalThis.fetch,
}: {
  identityUrl: string;
  secret?: string;
  fetch?: DirectMessageNotificationFetch;
}): DirectMessageNotificationPublisher {
  const token = secret?.trim();
  if (!token) return DISABLED_DIRECT_MESSAGE_NOTIFICATIONS;
  if (token.length < 32) throw new Error("CHAT_NOTIFICATION_SECRET must contain at least 32 characters");
  const endpoint = new URL("/api/notifications/direct-message", identityUrl);
  return {
    publish: async (input) => {
      const response = await send(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10_000),
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error(`Direct message notification failed with status ${response.status}`);
    },
  };
}

/** Notification delivery never delays or rolls back a message that is already durable in chat history. */
export function publishDirectMessageNotification(
  publisher: DirectMessageNotificationPublisher,
  session: PlayerSession,
  message: DirectMessageRecord,
): void {
  void publisher
    .publish({
      messageId: message.id,
      threadId: message.threadId,
      recipientOwner: message.recipientId,
      ...(session.displayName ? { senderDisplayName: session.displayName } : {}),
      createdAt: (message.createdAt ?? new Date()).getTime(),
    })
    .catch(() => console.warn("direct_message_notification_failed"));
}
