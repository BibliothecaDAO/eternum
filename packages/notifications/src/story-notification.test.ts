import { expect, it } from "vitest";
import { buildStoryNotification, storyNotificationCopy, storyNotificationCreatedAt } from "./story-notification";
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
  ["BuildingPlacementStory", { destroyed: true }, {}, "A building has fallen"],
  ["StructureLevelUpStory", { new_level: 4 }, {}, "Your realm grows stronger"],
  ["ResourceReceiveArrivalStory", {}, {}, "The caravan has arrived"],
  ["ProductionStory", {}, {}, "The workshops are humming"],
  ["BuildingPaymentStory", {}, {}, "Construction is underway"],
  ["ResourceTransferStory", { to_entity_id: 11 }, { entity_id: 11 }, "Supplies received"],
  ["ResourceBurnStory", {}, {}, "Resources committed"],
  ["ExplorerCreateStory", {}, {}, "An army answers the call"],
  ["ExplorerAddStory", {}, {}, "Reinforcements have arrived"],
  ["ExplorerDeleteStory", {}, {}, "The banners return home"],
  ["GuardAddStory", {}, {}, "The walls are reinforced"],
  ["GuardDeleteStory", {}, {}, "A guard post is clear"],
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
it.each([undefined, null, "", "bad", -1, 9007199254740991])(
  "rejects malformed or unsafe timestamps %s",
  (timestamp) => {
    expect(() => storyNotificationCreatedAt({ timestamp })).toThrow();
  },
);
