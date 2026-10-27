import { expect, it } from "vitest";
import { nativeStoryVariants } from "../../../contracts/l3/world-native/schema/client.gen";
import { buildStoryNotification, storyNotificationCopy, storyNotificationCreatedAt } from "./story-notification";
import { includesStoryNotification } from "./story-policy";
const input = {
  sourceId: "story:v1:0xa1:0x123:0x7:0xabc:0x64",
  value: { timestamp: "0x1", story: { RealmCreatedStory: {} } },
  owner: "0x1",
  gameName: "game",
  target: "/g/0xa1/7",
  now: 1100,
};
it("builds shared display content from the original event clock", () => {
  expect(buildStoryNotification(input)).toMatchObject({
    id: input.sourceId,
    title: "A new realm rises",
    body: "game: Your banner now flies over fresh lands.",
    createdAt: 1000,
    expiresAt: 121000,
  });
  expect(buildStoryNotification({ ...input, now: 121000 })).toBeNull();
});

it.each([
  ["StructureLevelUpStory", { new_level: 1 }, {}, "Your realm grows stronger"],
  ["ResourceReceiveArrivalStory", {}, {}, "The caravan has arrived"],
  ["ProductionStory", {}, {}, "The workshops are humming"],
  ["BuildingPaymentStory", {}, {}, "Construction is underway"],
  ["ResourceTransferStory", { to_entity_id: 11, travel_time: 0 }, { entity_id: 11 }, "Supplies received"],
  ["ResourceBurnStory", {}, {}, "Resources burned"],
  ["ExplorerCreateStory", {}, {}, "An army answers the call"],
  ["ExplorerAddStory", {}, {}, "Reinforcements have arrived"],
  ["ExplorerDeleteStory", {}, {}, "An army was disbanded"],
  ["GuardAddStory", {}, {}, "The walls are reinforced"],
  ["GuardDeleteStory", {}, {}, "A guard was dismissed"],
  ["RelicActivated", { relic_id: 41, recipient: "Explorer" }, {}, "Relic activated"],
] as const)("gives %s its own expressive action copy", (story, payload, value, title) => {
  expect(storyNotificationCopy(story, payload, value).title).toBe(title);
});
it.each([
  ["0x1", 101, "Victory on the field"],
  ["0x1", 202, "Your forces were defeated"],
  ["0x2", 202, "Victory on the field"],
  ["0x2", 101, "Your forces were defeated"],
  ["0x1", 0, "Battle lines have shifted"],
] as const)("tells player %s the native battle's outcome when %s wins", (recipient, winnerId, title) => {
  const payload = {
    attacker_id: 101,
    defender_id: 202,
    winner_id: winnerId,
    attacker: { player: "0x1" },
    defender: { player: "0x2" },
  };
  expect(storyNotificationCopy("BattleEvent", payload, {}, recipient).title).toBe(title);
});
it.each([
  ["0xc1", "0xa1", "The stronghold is yours", "Its armies and incoming deliveries are yours too."],
  ["0xa1", "0xa1", "A stronghold has fallen", "The enemy took it, with its armies and incoming deliveries."],
  ["0xc1", "0x0", "The stronghold is yours", "Your banner now flies over the captured site."],
] as const)("tells %s a capture from %s, and what changed hands with it", (recipient, previousOwner, title, body) => {
  expect(
    storyNotificationCopy(
      "StructureCapturedStory",
      { previous_owner: previousOwner, new_owner: "0xc1" },
      {},
      recipient,
    ),
  ).toEqual({ title, body });
});
it.each([undefined, null, "", "bad", -1, 9007199254740991])(
  "rejects malformed or unsafe timestamps %s",
  (timestamp) => {
    expect(() => storyNotificationCreatedAt({ timestamp })).toThrow();
  },
);

it.each([
  ["Created", "A new building takes shape"],
  ["Destroyed", "A building has fallen"],
  ["Paused", "Construction paused"],
  ["Resumed", "The hammers ring again"],
])("describes the native building change %s in live and background alerts", (change, title) => {
  expect(
    buildStoryNotification({
      ...input,
      value: {
        timestamp: "0x1",
        story: { BuildingPlacementStory: { coord: { alt: false, x: "0xb", y: "0xa" }, category: "0x25", change } },
      },
    }),
  ).toMatchObject({ title });
});

it.each([undefined, null, "", "Unknown"])("refuses a missing or unknown building change %s", (change) => {
  expect(() => storyNotificationCopy("BuildingPlacementStory", { change }, {})).toThrow(
    "Incomplete building placement story",
  );
});

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
  BuildingPlacementStory: { change: "Created" },
  StructureLevelUpStory: { new_level: 2 },
  ResourceTransferStory: { to_entity_id: 11, travel_time: 0 },
  RewardChestOpened: { amount: 25 },
  BankSwap: { buy: true },
  BankLiquidity: { add: true },
  HyperstructurePoints: { points: 40_000_000 },
  BitcoinAwardStory: { winner_paid: 5 },
  SkillPointSpent: { choice: "Battle", tier: 2, point_rank: 2, stamina: 30 },
  SitePayout: { reward: null },
  ExplorationReward: { receiver: 7, explorer_id: 9 },
  SpireDiscovered: { receiver: 7, explorer_id: 9 },
};
const DELIVERED = [...nativeStoryVariants, "BattleEvent", "RaidEvent"].filter((story) =>
  includesStoryNotification("all", story),
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
    expect(DELIVERED).toHaveLength(36);
    // No story borrows another's words, nor any line meant for all of them.
    expect(new Set(titles).size).toBe(DELIVERED.length);
    expect(titles).not.toContain("The realm is stirring");
  } finally {
    process.env.NODE_ENV = environment;
  }
});

it.each([
  [25, "A chest is open", "25 LORDS have reached your realm."],
  ["0x4e2", "A chest is open", "1,250 LORDS have reached your realm."],
  [0, "The chest was empty", "Its reservation ran out before it was opened: no LORDS were paid."],
] as const)("names the whole LORDS an exploration chest paid: %s", (amount, title, body) => {
  expect(storyNotificationCopy("RewardChestOpened", { amount }, {})).toEqual({ title, body });
});

it.each([
  ["BankSwap", { buy: true }, "Bought at the bank", "Your goods are on their way to your realm."],
  ["BankSwap", { buy: false }, "Sold at the bank", "Your LORDS are on their way to your realm."],
  ["BankLiquidity", { add: true }, "Liquidity added", "Your goods now stand in the bank's market."],
  // A withdrawal to a structure is still on the bank's donkeys; one naming no structure went to the wallet.
  [
    "BankLiquidity",
    { add: false, structure_id: 7 },
    "Liquidity withdrawn",
    "Your share of the market is on its way to your stores.",
  ],
  [
    "BankLiquidity",
    { add: false, structure_id: 0 },
    "Liquidity withdrawn",
    "Your share of the market was sent to your wallet.",
  ],
  // Story points are at the contract's precision: 5,000 whole points arrive as 5,000,000,000.
  [
    "HyperstructurePoints",
    { points: "5000000000" },
    "Hyperstructure points earned",
    "Your share brought 5,000 points.",
  ],
  ["HyperstructurePoints", { points: 1_000_000 }, "Hyperstructure points earned", "Your share brought 1 point."],
  [
    "HyperstructurePoints",
    { points: "0x1388" },
    "Hyperstructure points earned",
    "Your share brought less than a point.",
  ],
] as const)("words %s by what it carries", (story, payload, title, body) => {
  expect(storyNotificationCopy(story, payload, {})).toEqual({ title, body });
});

it("asks no words of a story that is never delivered", () => {
  expect(() => storyNotificationCopy("LordsWithdrawn", {}, {})).toThrow("Not a notified story: LordsWithdrawn");
});

it.each([
  [
    { winner_paid: "1000000", winner_destination: 7 },
    "The Bitcoin mine paid out",
    "Your share has reached your realm.",
  ],
  // A winner whose contributing realm is no longer theirs is paid nothing, though the mine's owner may be.
  [
    { winner_paid: 0, winner_destination: 0, owner_paid: "500000" },
    "Your Bitcoin share was not paid",
    "Nothing reached your realm this phase.",
  ],
] as const)("tells a Bitcoin phase's winner what was actually paid to them: %o", (payload, title, body) => {
  expect(storyNotificationCopy("BitcoinAwardStory", payload, {})).toEqual({ title, body });
});

it.each([
  [
    { choice: "Logistics", tier: 2, point_rank: 2, stamina: 30 },
    "Level up: Logistics",
    "Your army's Logistics is now Uncommon. Uncommon point spent; 30 stamina restored.",
  ],
  [
    { choice: "Homecoming", tier: "0x5", point_rank: 5, stamina: 60 },
    "Level up: Homecoming",
    "Your army's Homecoming is now Legendary. Legendary point spent; 60 stamina restored.",
  ],
] as const)("names the attribute a Level up raised and its new tier: %o", (payload, title, body) => {
  expect(storyNotificationCopy("SkillPointSpent", payload, {})).toEqual({ title, body });
});

it.each([
  ["ExplorationReward", { receiver: 7, explorer_id: 9 }, "Your army turned up resources; they reached your realm."],
  ["ExplorationReward", { receiver: 9, explorer_id: 9 }, "Your army turned up resources; your army carries them."],
  ["SpireDiscovered", { receiver: 7, explorer_id: 9 }, "Your army found a spire; its Essence reached your realm."],
  ["SpireDiscovered", { receiver: 9, explorer_id: 9 }, "Your army found a spire; your army carries its Essence."],
] as const)("says where %s's find went, as it was granted at once: %o", (story, payload, body) => {
  expect(storyNotificationCopy(story, payload, {}).body).toBe(body);
});

it.each([
  [{ reward: null }, "Your army earned its XP; nothing more was held."],
  [{ reward: { resource_type: 31, amount: 0 } }, "Your army earned its XP; the site held nothing to pay."],
  [
    { reward: { resource_type: 23, amount: "150000000000" } },
    "Your army earned its XP, and its reward reached your realm.",
  ],
] as const)("says what a cleared site paid its home: %o", (payload, body) => {
  expect(storyNotificationCopy("SitePayout", payload, {})).toEqual({ title: "A site is cleared", body });
});

it.each([
  [{ to_entity_id: 11, travel_time: 0 }, { entity_id: 11 }, "Supplies received", "A shipment has reached your stores."],
  [
    { to_entity_id: 11, travel_time: 600 },
    { entity_id: 11 },
    "Supplies on the road",
    "A shipment is on its way to your stores.",
  ],
  [
    { to_entity_id: 11, travel_time: 0 },
    { entity_id: 12 },
    "Supplies delivered",
    "Your shipment has reached its destination.",
  ],
  [{ to_entity_id: 11, travel_time: 600 }, { entity_id: 12 }, "Supplies dispatched", "Your shipment is on its way."],
  [{ to_entity_id: 11, travel_time: 600 }, {}, "Supplies are moving", "A shipment is on its way."],
] as const)("tells a transfer landed only when it took no road: %o for %o", (payload, value, title, body) => {
  expect(storyNotificationCopy("ResourceTransferStory", payload, value)).toEqual({ title, body });
});

it.each([
  [1, "It is now a City."],
  [3, "It is now an Empire."],
] as const)("names a structure's new level by its rank: %s", (level, body) => {
  expect(storyNotificationCopy("StructureLevelUpStory", { new_level: level }, {}).body).toBe(body);
});

it.each([
  ["BankLiquidity", { add: false }],
  ["BitcoinAwardStory", {}],
  ["SkillPointSpent", { choice: "Battle", tier: 9, point_rank: 9, stamina: 30 }],
  ["ExplorationReward", { explorer_id: 9 }],
  ["SitePayout", {}],
  ["ResourceTransferStory", { to_entity_id: 11 }],
  ["ResourceTransferStory", { to_entity_id: 11, travel_time: "soon" }],
  ["StructureLevelUpStory", { new_level: 7 }],
  ["HyperstructurePoints", {}],
] as const)("refuses to word %s from a payload that does not say it: %o", (story, payload) => {
  expect(() => storyNotificationCopy(story, payload, { entity_id: 11 })).toThrow(/^Incomplete /);
});
