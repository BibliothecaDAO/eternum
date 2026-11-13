import { expect, it } from "vitest";
import {
  nativeBaneConstants as bane,
  nativeQuestConstants as quest,
} from "../../../../contracts/l3/world-native/schema/client.gen";
import { dailyQuests, baneQuests, worldBanes } from "./quests";

it("presents each contract quest once, in bag order", () => {
  expect(dailyQuests.map(({ id }) => id)).toEqual(Array.from({ length: quest.QUEST_COUNT }, (_, id) => id));
  expect(new Set(dailyQuests.map(({ name }) => name)).size).toBe(quest.QUEST_COUNT);
  expect(dailyQuests.map(({ baseCount }) => baseCount)).toEqual([1, 1, 1, 1, 1, 2, 15]);
});

it("names every bane quest once alongside the daily catalog", () => {
  expect(baneQuests.map(({ id }) => id)).toEqual([quest.STAND, quest.LIGHTS, quest.CULL]);
  expect(new Set([...dailyQuests, ...baneQuests].map(({ id }) => id)).size).toBe(10);
});

it("names each of the contract's world banes once, with the bane quest banes.cairo gives it", () => {
  expect(worldBanes.map(({ id }) => id)).toEqual(Object.values(bane));
  expect(worldBanes.map(({ id, quest: questId }) => [id, questId])).toEqual([
    [bane.BLOOD_MOON, quest.STAND],
    [bane.MIST_TIDE, quest.LIGHTS],
    [bane.ASH_FALL, quest.CULL],
  ]);
});
