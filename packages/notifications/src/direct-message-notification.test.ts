import { expect, it } from "vitest";
import { buildDirectMessageNotification, parseDirectMessageNotificationInput } from "./direct-message-notification";

const input = {
  messageId: "11111111-1111-4111-8111-111111111111",
  threadId: "0x1|0x2",
  recipientOwner: "0x2",
  senderDisplayName: "Lady Ada",
  createdAt: 1_000,
};

it("builds thematic, privacy-safe DM copy with a per-thread collapse tag", () => {
  expect(buildDirectMessageNotification(input, 1_100)).toEqual({
    version: 1,
    id: `direct-message:${input.messageId}`,
    tag: `direct-thread:${input.threadId}`,
    owner: "0x2",
    title: "A raven from Lady Ada",
    body: "A private message awaits your reply in Realms.",
    target: "/",
    createdAt: 1_000,
    expiresAt: 121_000,
  });
});

it("uses a themed anonymous sender without accepting private content or invalid owners", () => {
  expect(buildDirectMessageNotification({ ...input, senderDisplayName: undefined }, 1_100).title).toBe(
    "A raven from another ruler",
  );
  expect(() => parseDirectMessageNotificationInput({ ...input, content: "secret" })).toThrow();
  expect(() => parseDirectMessageNotificationInput({ ...input, recipientOwner: "player-two" })).toThrow();
});

it("accepts a full two-address thread identity without overflowing the collapse tag", () => {
  const addressA = `0x${"1".repeat(64)}`;
  const addressB = `0x${"2".repeat(64)}`;
  expect(buildDirectMessageNotification({ ...input, threadId: `${addressA}|${addressB}` }, 1_100).tag).toContain(
    addressB,
  );
});
