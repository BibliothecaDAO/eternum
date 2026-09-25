import { expect, it } from "vitest";
import {
  isNotificationGameClient,
  logicalStoryIdentity,
  notificationMatchesGame,
  parseNotificationPayload,
} from "./delivery";

const now = 100_000;
const notification = {
  version: 1,
  id: "story:1",
  owner: "0x1",
  title: "Battle",
  body: "Confirmed activity",
  target: "/g/0xa1/1",
  createdAt: now,
  expiresAt: now + 120_000,
};

it("accepts bounded display envelopes and rejects expired, foreign, oversized or malformed payloads", () => {
  expect(parseNotificationPayload(notification, now)).toEqual(notification);
  for (const patch of [
    { version: 2 },
    { target: "https://other.example/g/0xa1/1" },
    { target: "//other.example" },
    { target: "/g/0xa1/1?redirect=https://other.example" },
    { target: "/g/0xa1/../1" },
    { expiresAt: now },
    { createdAt: now + 30_001 },
    { expiresAt: now + 120_001 },
    { title: "x".repeat(81) },
    { body: "bad\ntext" },
    { tag: "" },
    { state: {} },
    { owner: 0 },
  ]) {
    expect(() => parseNotificationPayload({ ...notification, ...patch }, now)).toThrow();
  }
});

it("groups the two delayed transfer records without collapsing unrelated transfers", () => {
  const payload = {
    transfer_type: { Delayed: {} },
    from_entity_id: 11,
    to_entity_id: 22,
    from_entity_owner_address: "0x1",
    to_entity_owner_address: "0x2",
  };
  const first = logicalStoryIdentity("source:0x64", "ResourceTransferStory", { entity_id: 11, owner: "0x1" }, payload);
  expect(logicalStoryIdentity("source:0x65", "ResourceTransferStory", { entity_id: 22, owner: "0x2" }, payload)).toBe(
    first,
  );
  expect(
    logicalStoryIdentity("source:0x66", "ResourceTransferStory", { entity_id: 11, owner: "0x1" }, payload),
  ).not.toBe(first);
  expect(() =>
    logicalStoryIdentity("source:0x65", "ResourceTransferStory", { entity_id: 99, owner: "0x2" }, payload),
  ).toThrow("Ambiguous");
  expect(
    logicalStoryIdentity("source:0x65", "ResourceTransferStory", {}, { ...payload, transfer_type: "Instant" }),
  ).toBe("source:0x65");
});

it("matches the intended game without changing another tab's route", () => {
  expect(
    notificationMatchesGame("https://game.test/g/0xa1/1/map?col=3", notification.target, "https://game.test"),
  ).toBe(true);
  expect(notificationMatchesGame("https://game.test/g/0xa1/2/map", notification.target, "https://game.test")).toBe(
    false,
  );
  expect(notificationMatchesGame("https://foreign.test/g/0xa1/1/map", notification.target, "https://game.test")).toBe(
    false,
  );
});

it("recognizes only same-origin game scenes as foreground notification clients", () => {
  expect(isNotificationGameClient("https://game.test/g/0xa1/1/map?col=3", "https://game.test")).toBe(true);
  expect(isNotificationGameClient("https://game.test/", "https://game.test")).toBe(false);
  expect(isNotificationGameClient("https://foreign.test/g/0xa1/1/map", "https://game.test")).toBe(false);
  expect(isNotificationGameClient("https://game.test/g/madara/1/map", "https://game.test")).toBe(false);
});

it("accepts games named by chain id and game id and rejects any other game address", () => {
  expect(parseNotificationPayload({ ...notification, target: "/" }, now).target).toBe("/");
  expect(parseNotificationPayload({ ...notification, target: "/g/0x57/12" }, now).target).toBe("/g/0x57/12");
  expect(() => parseNotificationPayload({ ...notification, target: "/g/madara/1" }, now)).toThrow();
});
