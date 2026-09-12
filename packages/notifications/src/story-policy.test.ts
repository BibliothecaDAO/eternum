import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { includesStoryNotification, storyNotificationRule, storyRecipients } from "./story-policy";
import { NOTIFICATION_LEVELS, parseNotificationPreferenceChange, parseNotificationPreferences } from "./preferences";

const levels = {
  important: ["BattleStory"],
  standard: [
    "RealmCreatedStory",
    "BuildingPlacementStory",
    "StructureLevelUpStory",
    "ExplorerExtractRewardStory",
    "ResourceReceiveArrivalStory",
  ],
  all: [
    "ProductionStory",
    "BuildingPaymentStory",
    "ResourceTransferStory",
    "ResourceBurnStory",
    "ExplorerMoveStory",
    "ExplorerCreateStory",
    "ExplorerAddStory",
    "ExplorerDeleteStory",
    "ExplorerExplorerSwapStory",
    "ExplorerGuardSwapStory",
    "GuardExplorerSwapStory",
    "GuardAddStory",
    "GuardDeleteStory",
  ],
  excluded: [
    "PointsRegisteredStory",
    "PrizeDistributionFinalStory",
    "FaithPledgedStory",
    "FaithRemovedStory",
    "FaithPointsClaimedStory",
    "BitcoinMineProductionStory",
    "BitcoinPhaseLotteryStory",
  ],
} as const;

it("covers the exact deployed Story enum and tests every cumulative level", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../../../contracts/l3/game/manifest_madara.json", import.meta.url), "utf8"),
  );
  const event = manifest.events.find((event: { tag: string }) => event.tag.endsWith("-StoryEvent"));
  const storyType = event.members.find((member: { name: string }) => member.name === "story").type;
  const storyEnum = manifest.abis.find(
    (entry: { name?: string; type: string }) => entry.name === storyType && entry.type === "enum",
  );
  const variants = storyEnum.variants.map((variant: { name: string }) => variant.name);
  expect(variants.sort()).toEqual(Object.values(levels).flat().sort());
  for (const [minimum, stories] of Object.entries(levels)) {
    for (const story of stories) {
      expect(storyNotificationRule(story)).toBeDefined();
      for (const level of NOTIFICATION_LEVELS) {
        const expected =
          minimum !== "excluded" && NOTIFICATION_LEVELS.indexOf(level) >= NOTIFICATION_LEVELS.indexOf(minimum as "all");
        expect(includesStoryNotification(level, story), `${story} at ${level}`).toBe(expected);
      }
    }
  }
  expect(() => includesStoryNotification("off", "PrizeDistributedStory")).toThrow("Unknown");
});

it("uses event-time recipients, normalizes duplicates, and excludes neutral addresses", () => {
  const payload = {
    attacker_owner_address: "0x0001",
    defender_owner_address: 2n,
    from_entity_owner_address: "0x01",
    to_entity_owner_address: "2",
    explorer_owner: "0x02",
  };
  for (const story of [...levels.important, ...levels.standard, ...levels.all]) {
    const expected =
      story === "BattleStory" || story === "ResourceTransferStory"
        ? ["0x1", "0x2"]
        : story === "ExplorerMoveStory" || story === "ExplorerExtractRewardStory"
          ? ["0x2"]
          : ["0x3"];
    expect(storyRecipients(story, "0x003", payload), story).toEqual(expected);
  }
  expect(
    storyRecipients("BattleStory", "0xff", { attacker_owner_address: "0x1", defender_owner_address: "0x01" }),
  ).toEqual(["0x1"]);
  expect(
    storyRecipients("BattleStory", "0xff", { attacker_owner_address: "0x0", defender_owner_address: "0x2" }),
  ).toEqual(["0x2"]);
  for (const story of levels.excluded) expect(storyRecipients(story, "0x1", {})).toEqual([]);
  expect(() => storyRecipients("BattleStory", "0x1", {})).toThrow("event-time");
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
