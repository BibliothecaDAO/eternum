import { expect, it } from "vitest";

import { buildMentionNotification } from "./mention-notification";

const input = {
  messageId: "11111111-1111-4111-8111-111111111111",
  recipientOwner: "0x2",
  senderDisplayName: "Lady Ada",
  place: { kind: "global" },
  createdAt: 1_000,
};

it("names who mentioned the player and where, never the message, opening the app's chat", () => {
  expect(buildMentionNotification(input, 1_100)).toEqual({
    version: 1,
    id: `mention:${input.messageId}`,
    tag: "mention:global",
    owner: "0x2",
    title: "Lady Ada mentioned you",
    body: "In Global. Open Realms to read it.",
    target: "/chat",
    createdAt: 1_000,
    expiresAt: 121_000,
  });
});

it("opens a Blitz lobby's mention in that lobby, one alert per lobby", () => {
  const lobby = buildMentionNotification({ ...input, place: { kind: "lobby", slot: "blitz-1630" } }, 1_100);
  expect(lobby).toMatchObject({
    tag: "mention:lobby:blitz-1630",
    body: "In a Blitz lobby. Open Realms to read it.",
    target: "/blitz/slot-blitz-1630",
  });
});

it("names an unnamed sender plainly, and takes no message text, no other place and no invalid owner", () => {
  expect(buildMentionNotification({ ...input, senderDisplayName: undefined }, 1_100).title).toBe(
    "Another player mentioned you",
  );
  expect(() => buildMentionNotification({ ...input, content: "secret" }, 1_100)).toThrow();
  expect(() => buildMentionNotification({ ...input, place: { kind: "game" } }, 1_100)).toThrow();
  expect(() => buildMentionNotification({ ...input, recipientOwner: "player-two" }, 1_100)).toThrow();
});
