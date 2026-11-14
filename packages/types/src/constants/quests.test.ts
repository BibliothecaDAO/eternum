import { expect, it } from "vitest";
import { nativeQuestConstants as quest } from "../../../../contracts/l3/world-native/schema/client.gen";
import { dailyQuests, baneQuests, questCatalog } from "./quests";

it("presents each contract quest once, in bag order", () => {
  expect(dailyQuests.map(({ id }) => id)).toEqual(Array.from({ length: quest.QUEST_COUNT }, (_, id) => id));
  expect(new Set(dailyQuests.map(({ name }) => name)).size).toBe(quest.QUEST_COUNT);
});

it("presents every bane quest once without putting it in the daily rotation", () => {
  expect(baneQuests.map(({ id }) => id)).toEqual([quest.STAND, quest.LIGHTS, quest.CULL]);
  expect(new Set(questCatalog.map(({ id }) => id)).size).toBe(quest.QUEST_COUNT + 3);
  expect(new Set(questCatalog.map(({ name }) => name)).size).toBe(quest.QUEST_COUNT + 3);
});
