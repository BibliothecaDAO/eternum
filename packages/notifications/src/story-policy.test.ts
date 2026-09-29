import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { includesStoryNotification, storyNotificationRule, storyRecipients } from "./story-policy";
import { NOTIFICATION_LEVELS, parseNotificationPreferenceChange, parseNotificationPreferences } from "./preferences";

it("covers every native story and tests every cumulative level", () => {
  const schema = JSON.parse(
    readFileSync(new URL("../../../contracts/l3/world-native/schema/schema.json", import.meta.url), "utf8"),
  );
  const event = schema.events.find((event: { name: string }) => event.name === "StoryEvent");
  const storyType = event.event.members.find((member: { name: string }) => member.name === "story").type;
  const variants = schema.types[storyType].variants.map((variant: { name: string }) => variant.name);
  const nativeLevels = {
    important: ["BattleEvent", "RaidEvent"],
    standard: ["RealmCreatedStory", "BuildingPlacementStory", "StructureLevelUpStory", "ResourceReceiveArrivalStory"],
    all: [
      "ProductionStory",
      "BuildingPaymentStory",
      "ResourceTransferStory",
      "ResourceBurnStory",
      "ExplorerCreateStory",
      "ExplorerAddStory",
      "ExplorerDeleteStory",
      "GuardAddStory",
      "GuardDeleteStory",
      "StructureCapturedStory",
      "BitcoinAwardStory",
      "TradeCreated",
      "TradeAccepted",
      "TradeCancelled",
      "BankSwap",
      "BankLiquidity",
      "HyperstructurePoints",
      "RelicChestOpened",
      "ChestReward",
      "AttributeChosen",
      "SitePayout",
      "ExplorationReward",
      "SeasonEnded",
      "FaithPledged",
      "FaithRemoved",
      "BlitzFinalized",
      "RelicCrafted",
      "TroopsTransferred",
    ],
    excluded: ["FaithPointsClaimedStory"],
  };
  expect([...variants, "BattleEvent", "RaidEvent"].sort()).toEqual(Object.values(nativeLevels).flat().sort());
  for (const [minimum, stories] of Object.entries(nativeLevels)) {
    for (const story of stories) {
      expect(storyNotificationRule(story)).toBeDefined();
      for (const level of NOTIFICATION_LEVELS) {
        const expected =
          minimum !== "excluded" && NOTIFICATION_LEVELS.indexOf(level) >= NOTIFICATION_LEVELS.indexOf(minimum as "all");
        expect(includesStoryNotification(level, story), `${story} at ${level}`).toBe(expected);
      }
    }
  }
});

it("knows no retired Dojo story: a variant the chain no longer emits is unknown", () => {
  expect(() => storyNotificationRule("BattleStory")).toThrow("Unknown notification story: BattleStory");
});

it("uses event-time recipients, normalizes duplicates, and excludes neutral addresses", () => {
  const battle = { attacker: { player: "0x0001" }, defender: { player: 2n } };
  expect(storyRecipients("BattleEvent", "0x003", battle)).toEqual(["0x1", "0x2"]);
  expect(storyRecipients("RaidEvent", "0x003", { player: "0x01", target_owner: "2" })).toEqual(["0x1", "0x2"]);
  expect(
    storyRecipients("ResourceTransferStory", "0x003", {
      from_entity_owner_address: "0x01",
      to_entity_owner_address: "2",
    }),
  ).toEqual(["0x1", "0x2"]);
  expect(storyRecipients("RealmCreatedStory", "0x003", battle)).toEqual(["0x3"]);
  expect(storyRecipients("AttributeChosen", "0x003", { explorer_id: 7 })).toEqual(["0x3"]);
  expect(storyRecipients("BattleEvent", "0xff", { attacker: { player: "0x1" }, defender: { player: "0x01" } })).toEqual(
    ["0x1"],
  );
  expect(storyRecipients("BattleEvent", "0xff", { attacker: { player: "0x0" }, defender: { player: "0x2" } })).toEqual([
    "0x2",
  ]);
  expect(storyRecipients("FaithPointsClaimedStory", "0x1", {})).toEqual([]);
  expect(() => storyRecipients("BattleEvent", "0x1", { attacker: {}, defender: {} })).toThrow("event-time");
  expect(() => storyRecipients("RealmCreatedStory", "garbage", {})).toThrow();
});

it("validates the versioned preference boundary without accepting owner overrides or invalid revisions", () => {
  expect(parseNotificationPreferences({ owner: "0x1", level: "off", revision: 0 })).toEqual({
    owner: "0x1",
    level: "off",
    revision: 0,
  });
  for (const change of [
    { level: "urgent", revision: 0 },
    { level: "all", revision: -1 },
    { level: "all", revision: 0.5 },
    { level: "all", revision: "1" },
    { level: "off", revision: 0, owner: "0x2" },
  ]) {
    expect(() => parseNotificationPreferenceChange(change)).toThrow("invalid_preferences");
  }
});

it("excludes unknown variants in production and diagnoses them in development", () => {
  try {
    vi.stubEnv("NODE_ENV", "production");
    expect(includesStoryNotification("all", "FutureStory")).toBe(false);
    expect(storyRecipients("FutureStory", "0x1", {})).toEqual([]);
    vi.stubEnv("NODE_ENV", "development");
    expect(() => includesStoryNotification("all", "FutureStory")).toThrow("Unknown notification story");
  } finally {
    vi.unstubAllEnvs();
  }
});

it("routes native battles and raids to the owners recorded in the event", () => {
  expect(includesStoryNotification("important", "BattleEvent")).toBe(true);
  expect(storyRecipients("BattleEvent", null, { attacker: { player: "0x11" }, defender: { player: "0x12" } })).toEqual([
    "0x11",
    "0x12",
  ]);
  expect(storyRecipients("RaidEvent", null, { player: "0x11", target_owner: "0x12" })).toEqual(["0x11", "0x12"]);
});

it("notifies the acting owner of a native troop transfer only at all activity level", () => {
  expect(includesStoryNotification("standard", "TroopsTransferred")).toBe(false);
  expect(includesStoryNotification("all", "TroopsTransferred")).toBe(true);
  expect(storyRecipients("TroopsTransferred", "0x0003", {})).toEqual(["0x3"]);
});

it("notifies both owners for player capture, excluding the zero bandit owner", () => {
  expect(storyRecipients("StructureCapturedStory", "0x222", { previous_owner: "0x111" })).toEqual(["0x222", "0x111"]);
  expect(storyRecipients("StructureCapturedStory", "0x222", { previous_owner: "0x0" })).toEqual(["0x222"]);
});
