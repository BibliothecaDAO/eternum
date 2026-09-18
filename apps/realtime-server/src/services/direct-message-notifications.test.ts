import { afterEach, expect, it, vi } from "vitest";
import {
  createDirectMessageNotificationPublisher,
  DISABLED_DIRECT_MESSAGE_NOTIFICATIONS,
  type DirectMessageNotificationFetch,
} from "./direct-message-notifications";

afterEach(() => vi.restoreAllMocks());

it("stays disabled without a server-to-server secret", async () => {
  const fetch = vi.fn<DirectMessageNotificationFetch>();
  const publisher = createDirectMessageNotificationPublisher({ identityUrl: "https://identity.test", fetch });
  await publisher.publish({
    messageId: "message-1",
    threadId: "thread-1",
    recipientOwner: "0x2",
    createdAt: 1_000,
  });
  expect(publisher).toBe(DISABLED_DIRECT_MESSAGE_NOTIFICATIONS);
  expect(fetch).not.toHaveBeenCalled();
});

it("publishes only bounded notification context over the authenticated internal route", async () => {
  const fetch = vi.fn<DirectMessageNotificationFetch>().mockResolvedValue(new Response(null, { status: 202 }));
  const publisher = createDirectMessageNotificationPublisher({
    identityUrl: "https://identity.test",
    secret: "s".repeat(32),
    fetch,
  });
  await publisher.publish({
    messageId: "message-1",
    threadId: "thread-1",
    recipientOwner: "0x2",
    senderDisplayName: "Lady Ada",
    createdAt: 1_000,
  });
  expect(fetch).toHaveBeenCalledWith(
    new URL("https://identity.test/api/notifications/direct-message"),
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: `Bearer ${"s".repeat(32)}` }),
      body: JSON.stringify({
        messageId: "message-1",
        threadId: "thread-1",
        recipientOwner: "0x2",
        senderDisplayName: "Lady Ada",
        createdAt: 1_000,
      }),
    }),
  );
  expect(fetch.mock.calls[0]?.[1]?.body).not.toContain("content");
});

it("rejects weak secrets and failed identity delivery", async () => {
  expect(() =>
    createDirectMessageNotificationPublisher({ identityUrl: "https://identity.test", secret: "short" }),
  ).toThrow("32 characters");
  const publisher = createDirectMessageNotificationPublisher({
    identityUrl: "https://identity.test",
    secret: "s".repeat(32),
    fetch: vi.fn<DirectMessageNotificationFetch>().mockResolvedValue(new Response(null, { status: 503 })),
  });
  await expect(
    publisher.publish({ messageId: "m", threadId: "t", recipientOwner: "0x2", createdAt: 1_000 }),
  ).rejects.toThrow("503");
});
