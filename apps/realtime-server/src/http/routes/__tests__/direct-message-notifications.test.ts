import { Effect } from "effect";
import { Hono } from "hono";
import { expect, it, vi } from "vitest";

const records = vi.hoisted(() => {
  const message = {
    id: "message-1",
    threadId: "0x1|0x2",
    senderId: "0x1",
    recipientId: "0x2",
    content: "private words",
    metadata: null,
    createdAt: new Date(1_000),
  };
  return {
    message,
    thread: {
      id: message.threadId,
      playerAId: "0x1",
      playerBId: "0x2",
      createdAt: new Date(1_000),
      updatedAt: new Date(1_000),
      lastMessageId: message.id,
      lastMessageAt: new Date(1_000),
      unreadCounts: { "0x1": 0, "0x2": 1 },
      metadata: null,
    },
  };
});
vi.mock("../../../services/direct-messages", async () => {
  class DirectMessageError extends Error {}
  return {
    DirectMessageError,
    persistDirectMessage: () =>
      Effect.succeed({ message: records.message, thread: records.thread, participants: ["0x1", "0x2"] }),
    markDirectMessageRead: () => Effect.void,
  };
});

import type { AppEnv } from "../../middleware/auth";
import { createDirectMessageRoutes } from "../direct-messages";

it("publishes a DM notification only after the HTTP message is durable", async () => {
  const publisher = { publish: vi.fn().mockResolvedValue(undefined) };
  const app = new Hono<AppEnv>();
  app.use("*", async (context, next) => {
    context.set("playerSession", {
      playerId: "0x1",
      membershipPlayerId: null,
      displayName: "Lady Ada",
      aliases: ["0x1"],
    });
    await next();
  });
  app.route("/api/chat/dm", createDirectMessageRoutes(publisher));

  const response = await app.request("/api/chat/dm/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipientId: "0x2", content: "private words" }),
  });
  expect(response.status).toBe(201);
  await vi.waitFor(() =>
    expect(publisher.publish).toHaveBeenCalledWith({
      messageId: "message-1",
      threadId: "0x1|0x2",
      recipientOwner: "0x2",
      senderDisplayName: "Lady Ada",
      createdAt: 1_000,
    }),
  );
  expect(JSON.stringify(publisher.publish.mock.calls[0])).not.toContain("private words");
});
