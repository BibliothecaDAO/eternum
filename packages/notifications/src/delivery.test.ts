import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { logicalStoryIdentity, notificationMatchesGame, parseNotificationPayload } from "./delivery";

const now = 100_000;
const notification = {
  version: 1,
  id: "story:1",
  owner: "0x1",
  title: "Battle",
  body: "Confirmed activity",
  target: "/enter/madara/game-1",
  createdAt: now,
  expiresAt: now + 120_000,
};

it("accepts bounded display envelopes and rejects expired, foreign, oversized or malformed payloads", () => {
  expect(parseNotificationPayload(notification, now)).toEqual(notification);
  for (const patch of [
    { version: 2 },
    { target: "https://other.example/enter/madara/game" },
    { target: "//other.example" },
    { target: "/enter/madara/game?redirect=https://other.example" },
    { target: "/enter/madara/../game" },
    { expiresAt: now },
    { createdAt: now + 30_001 },
    { expiresAt: now + 120_001 },
    { title: "x".repeat(81) },
    { body: "bad\ntext" },
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

it("pins the mirrored identity assumption to the Cairo emitter order and locked Dojo version", () => {
  const root = new URL("../../../", import.meta.url);
  const battles = readFileSync(
    new URL("contracts/l3/game/src/systems/combat/contracts/troop_battle.cairo", root),
    "utf8",
  );
  const pairs = [
    ...battles.matchAll(
      /\/\/ Emit from attacker perspective([\s\S]*?)\/\/ Emit from defender perspective([\s\S]*?story: Story::BattleStory\(battle_story\))/g,
    ),
  ];
  expect(pairs).toHaveLength(3);
  for (const pair of pairs) {
    expect(pair[1].match(/dispatcher\.uuid\(\)/g)).toHaveLength(1);
    expect(pair[2].match(/dispatcher\.uuid\(\)/g)).toHaveLength(1);
  }
  expect(readFileSync(new URL("contracts/l3/game/Scarb.lock", root), "utf8")).toMatch(
    /name = "dojo"\nversion = "1\.8\.0"/,
  );
});

it("matches the intended game without changing another tab's route", () => {
  expect(
    notificationMatchesGame("https://game.test/play/madara/game-1/map?col=3", notification.target, "https://game.test"),
  ).toBe(true);
  expect(
    notificationMatchesGame("https://game.test/play/madara/game-2/map", notification.target, "https://game.test"),
  ).toBe(false);
  expect(
    notificationMatchesGame("https://foreign.test/play/madara/game-1/map", notification.target, "https://game.test"),
  ).toBe(false);
});
