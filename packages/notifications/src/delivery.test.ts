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
  target: "/enter/0xa1/1",
  createdAt: now,
  expiresAt: now + 120_000,
};

it("accepts bounded display envelopes and rejects expired, foreign, oversized or malformed payloads", () => {
  expect(parseNotificationPayload(notification, now)).toEqual(notification);
  for (const patch of [
    { version: 2 },
    { target: "https://other.example/enter/0xa1/1" },
    { target: "//other.example" },
    { target: "/enter/0xa1/1?redirect=https://other.example" },
    { target: "/enter/0xa1/../1" },
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

it("gives mirrored battle copies one ID and separates identical battles in the same transaction", () => {
  const base = "story:v1:madara:0x123:0x7:0xabc:";
  const payload = { attacker_id: 11, defender_id: 22, attacker_owner_address: "0x1", defender_owner_address: "0x2" };
  const attacker = { entity_id: 11, owner: "0x01" },
    defender = { entity_id: 22, owner: "0x02" };
  const first = logicalStoryIdentity(base + "0x64", "BattleStory", attacker, payload);
  expect(logicalStoryIdentity(base + "0x65", "BattleStory", defender, payload)).toBe(first);
  expect(logicalStoryIdentity(base + "0x66", "BattleStory", attacker, payload)).not.toBe(first);
  expect(() => logicalStoryIdentity(base + "0x65", "BattleStory", { entity_id: 99, owner: "0x02" }, payload)).toThrow(
    "Ambiguous",
  );
});

it("also groups the two delayed transfer records without collapsing unrelated transfers", () => {
  const payload = {
    transfer_type: { Delayed: {} },
    from_entity_id: 11,
    to_entity_id: 22,
    from_entity_owner_address: "0x1",
    to_entity_owner_address: "0x2",
  };
  expect(logicalStoryIdentity("source:0x65", "ResourceTransferStory", { entity_id: 22, owner: "0x2" }, payload)).toBe(
    logicalStoryIdentity("source:0x64", "ResourceTransferStory", { entity_id: 11, owner: "0x1" }, payload),
  );
  expect(
    logicalStoryIdentity("source:0x65", "ResourceTransferStory", {}, { ...payload, transfer_type: "Instant" }),
  ).toBe("source:0x65");
});

it("matches the intended game without changing another tab's route", () => {
  expect(
    notificationMatchesGame("https://game.test/play/0xa1/1/map?col=3", notification.target, "https://game.test"),
  ).toBe(true);
  expect(notificationMatchesGame("https://game.test/play/0xa1/2/map", notification.target, "https://game.test")).toBe(
    false,
  );
  expect(
    notificationMatchesGame("https://foreign.test/play/0xa1/1/map", notification.target, "https://game.test"),
  ).toBe(false);
});

it("recognizes only same-origin game scenes as foreground notification clients", () => {
  expect(isNotificationGameClient("https://game.test/play/0xa1/1/map?col=3", "https://game.test")).toBe(true);
  expect(isNotificationGameClient("https://game.test/", "https://game.test")).toBe(false);
  expect(isNotificationGameClient("https://foreign.test/play/0xa1/1/map", "https://game.test")).toBe(false);
  expect(isNotificationGameClient("https://game.test/play/unknown/1/map", "https://game.test")).toBe(false);
});

it("accepts games named by chain id and game id and rejects any other game address", () => {
  expect(parseNotificationPayload({ ...notification, target: "/" }, now).target).toBe("/");
  expect(parseNotificationPayload({ ...notification, target: "/enter/0x57/12" }, now).target).toBe("/enter/0x57/12");
  expect(() => parseNotificationPayload({ ...notification, target: "/enter/madara/game-1" }, now)).toThrow();
});
