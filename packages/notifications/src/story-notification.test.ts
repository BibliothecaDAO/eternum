import { expect, it } from "vitest";
import { nativeStoryVariants } from "../../../contracts/l3/world-native/schema/client.gen";
import { buildStoryNotification, storyNotificationCopy, storyNotificationCreatedAt } from "./story-notification";
import { includesStoryNotification } from "./story-policy";
const input = {
  sourceId: "story:v1:0xa1:0x123:0x7:0xabc:0x64",
  value: { timestamp: "0x1", story: { SeasonEnded: {} } },
  owner: "0x1",
  gameName: "game",
  target: "/g/0xa1/7",
  now: 1100,
};
it("builds shared display content from the original event clock", () => {
  expect(buildStoryNotification(input)).toMatchObject({
    id: input.sourceId,
    title: "The season is over",
    body: "game: see where you finished.",
    createdAt: 1000,
    expiresAt: 121000,
  });
  expect(buildStoryNotification({ ...input, now: 121000 })).toBeNull();
});

it.each([
  ["SeasonEnded", {}, "The season is over"],
  ["BlitzFinalized", {}, "Your Blitz is settled"],
  ["ResourceReceiveArrivalStory", {}, "Your caravan arrived"],
  ["TradeAccepted", {}, "A trade was filled"],
  ["ResourceTransferStory", { to_entity_id: 11, travel_time: 0 }, "Resources received"],
] as const)("gives %s its own words", (story, payload, title) => {
  expect(storyNotificationCopy(story, payload).title).toBe(title);
});
it.each([
  ["0x1", 101, "You won a battle"],
  ["0x1", 202, "You lost a battle"],
  ["0x2", 202, "You won a battle"],
  ["0x2", 101, "You lost a battle"],
  ["0x1", 0, "A battle ended"],
] as const)("tells player %s the native battle's outcome when %s wins", (recipient, winnerId, title) => {
  const payload = {
    attacker_id: 101,
    defender_id: 202,
    winner_id: winnerId,
    attacker: { player: "0x1" },
    defender: { player: "0x2" },
  };
  expect(storyNotificationCopy("BattleEvent", payload, recipient).title).toBe(title);
});
it.each([
  ["0xc1", "0xa1", "You took a structure", "its armies and incoming deliveries are yours too."],
  ["0xa1", "0xa1", "You lost a structure", "the enemy took it with its armies and incoming deliveries."],
  ["0xc1", "0x0", "You took a structure", "it is yours now."],
] as const)("tells %s a capture from %s, and what changed hands with it", (recipient, previousOwner, title, body) => {
  expect(
    storyNotificationCopy("StructureCapturedStory", { previous_owner: previousOwner, new_owner: "0xc1" }, recipient),
  ).toEqual({ title, body });
});
it.each([undefined, null, "", "bad", -1, 9007199254740991])(
  "rejects malformed or unsafe timestamps %s",
  (timestamp) => {
    expect(() => storyNotificationCreatedAt({ timestamp })).toThrow();
  },
);

/** What each delivered story needs to be worded; every other story is worded from nothing but its name. */
const PAYLOADS: Record<string, Record<string, unknown>> = {
  BattleEvent: {
    attacker_id: 1,
    defender_id: 2,
    winner_id: 1,
    attacker: { player: "0x1" },
    defender: { player: "0x2" },
  },
  RaidEvent: { player: "0x1", target_owner: "0x2", success: true },
  StructureCapturedStory: { previous_owner: "0x2", new_owner: "0x1" },
  ResourceTransferStory: { to_entity_id: 11, travel_time: 0 },
  HyperstructurePoints: { points: 40_000_000 },
  BitcoinAwardStory: { winner_paid: 5 },
};
const DELIVERED = [...nativeStoryVariants, "BattleEvent", "RaidEvent"].filter((story) =>
  includesStoryNotification("all", story, "blitz"),
);

it("puts every delivered story into its own words, in production as in development", () => {
  const environment = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const titles = DELIVERED.map((story) => {
      const model = story === "BattleEvent" || story === "RaidEvent" ? story : "StoryEvent";
      const payload = PAYLOADS[story] ?? {};
      const value =
        model === "StoryEvent" ? { timestamp: "0x1", story: { [story]: payload } } : { timestamp: "0x1", ...payload };
      const alert = buildStoryNotification({ ...input, model, value, recipient: "0x1" });
      expect(alert?.body.startsWith("game: ")).toBe(true);
      return alert!.title;
    });
    expect(DELIVERED.sort()).toEqual(
      [
        "BattleEvent",
        "BitcoinAwardStory",
        "BlitzFinalized",
        "HyperstructurePoints",
        "RaidEvent",
        "ResourceReceiveArrivalStory",
        "ResourceTransferStory",
        "SeasonEnded",
        "StructureCapturedStory",
        "TradeAccepted",
      ].sort(),
    );
    // No story borrows another's words.
    expect(new Set(titles).size).toBe(DELIVERED.length);
  } finally {
    process.env.NODE_ENV = environment;
  }
});

it.each([
  // Story points are at the contract's precision: 5,000 whole points arrive as 5,000,000,000.
  [{ points: "5000000000" }, "your share is 5,000 points."],
  [{ points: 1_000_000 }, "your share is 1 point."],
  [{ points: "0x1388" }, "your share is less than a point."],
] as const)("words a Hyperstructure share by what it brought: %o", (payload, body) => {
  expect(storyNotificationCopy("HyperstructurePoints", payload)).toEqual({
    title: "You earned Hyperstructure points",
    body,
  });
});

it.each(["LordsWithdrawn", "BuildingPlacementStory", "ExplorationReward", "SkillPointSpent", "RewardChestOpened"])(
  "asks no words of %s, which no push tells",
  (story) => {
    expect(() => storyNotificationCopy(story, {})).toThrow(`Not a notified story: ${story}`);
  },
);

it.each([
  [{ winner_paid: "1000000", winner_destination: 7 }, "The Bitcoin mine paid you", "your share is in your realm."],
  // A winner whose contributing realm is no longer theirs is paid nothing, though the mine's owner may be.
  [
    { winner_paid: 0, winner_destination: 0, owner_paid: "500000" },
    "Your Bitcoin share was not paid",
    "the realm you contributed from is no longer yours.",
  ],
] as const)("tells a Bitcoin phase's winner what was actually paid to them: %o", (payload, title, body) => {
  expect(storyNotificationCopy("BitcoinAwardStory", payload)).toEqual({ title, body });
});

it.each([
  [{ to_entity_id: 11, travel_time: 0 }, "Resources received", "they are in your stores."],
  [{ to_entity_id: 11, travel_time: 600 }, "Resources on the way", "a shipment is heading to your stores."],
] as const)("tells the receiver goods landed only when they took no road: %o", (payload, title, body) => {
  expect(storyNotificationCopy("ResourceTransferStory", payload)).toEqual({ title, body });
});

it.each([
  ["BitcoinAwardStory", {}],
  ["ResourceTransferStory", { to_entity_id: 11 }],
  ["ResourceTransferStory", { to_entity_id: 11, travel_time: "soon" }],
  ["HyperstructurePoints", {}],
] as const)("refuses to word %s from a payload that does not say it: %o", (story, payload) => {
  expect(() => storyNotificationCopy(story, payload)).toThrow(/^Incomplete /);
});
