import { expect, it } from "vitest";
import { nativeQuestConstants as quest } from "../../../../contracts/l3/world-native/schema/client.gen";
import { dailyQuests } from "./quests";

it("presents each contract quest once, in bag order", () => {
  expect(dailyQuests.map(({ id }) => id)).toEqual(Array.from({ length: quest.QUEST_COUNT }, (_, id) => id));
  expect(new Set(dailyQuests.map(({ name }) => name)).size).toBe(quest.QUEST_COUNT);
});
