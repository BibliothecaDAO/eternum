import { expect, it } from "vitest";
import { buildStoryNotification, storyNotificationCopy, storyNotificationCreatedAt } from "./story-notification";
const input = {
  sourceId: "story:v1:0xa1:0x123:0x7:0xabc:0x64",
  value: { timestamp: "0x1", story: { RealmCreatedStory: {} } },
  owner: "0x1",
  gameName: "game",
  target: "/enter/0xa1/7",
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
  ["BuildingPlacementStory", { destroyed: true }, {}, "A building has fallen"],
  ["StructureLevelUpStory", { new_level: 4 }, {}, "Your realm grows stronger"],
  ["ExplorerExtractRewardStory", {}, {}, "Your scouts struck treasure"],
  ["ResourceReceiveArrivalStory", {}, {}, "The caravan has arrived"],
  ["ProductionStory", {}, {}, "The workshops are humming"],
  ["BuildingPaymentStory", {}, {}, "Construction is underway"],
  ["ResourceTransferStory", { to_entity_id: 11 }, { entity_id: 11 }, "Supplies received"],
  ["ResourceBurnStory", {}, {}, "Resources committed"],
  ["ExplorerMoveStory", { explore: true }, {}, "Into the unknown"],
  ["ExplorerCreateStory", {}, {}, "An army answers the call"],
  ["ExplorerAddStory", {}, {}, "Reinforcements have arrived"],
  ["ExplorerDeleteStory", {}, {}, "The banners return home"],
  ["GuardAddStory", {}, {}, "The walls are reinforced"],
  ["GuardDeleteStory", {}, {}, "A guard post is clear"],
  ["ExplorerExplorerSwapStory", {}, {}, "Troops redeployed"],
  ["ExplorerGuardSwapStory", {}, {}, "Troops redeployed"],
  ["GuardExplorerSwapStory", {}, {}, "Troops redeployed"],
] as const)("gives %s its own expressive action copy", (story, payload, value, title) => {
  expect(storyNotificationCopy(story, payload, value).title).toBe(title);
});
it.each([
  [101, 11, "Victory on the field"],
  [101, 22, "Your forces were defeated"],
  [202, 22, "Victory on the field"],
  [202, 11, "Your forces were defeated"],
  [101, 0, "Battle lines have shifted"],
  [202, 0, "Battle lines have shifted"],
] as const)("resolves army %s's battle outcome from winning structure %s", (entityId, winnerId, title) => {
  const payload = {
    attacker_id: 101,
    attacker_owner_id: 11,
    defender_id: 202,
    defender_owner_id: 22,
    winner_id: winnerId,
  };
  expect(storyNotificationCopy("BattleStory", payload, { entity_id: entityId }).title).toBe(title);
});
it.each([undefined, null, "", "bad", -1, 9007199254740991])(
  "rejects malformed or unsafe timestamps %s",
  (timestamp) => {
    expect(() => storyNotificationCreatedAt({ timestamp })).toThrow();
  },
);
