import { useEntityQuery } from "@dojoengine/react";
import { HasValue, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context";

export const useQuests = () => {
  const {
    setup: { components },
  } = useDojo();

  const questDetailEntities = useEntityQuery([HasValue(components.QuestDetails, {})]);

  console.log(questDetailEntities);

  // Map the entities to their quest details
  const quests = questDetailEntities
    .map((entity) => {
      const questDetails = getComponentValue(components.QuestDetails, entity);
      return {
        entityId: entity,
        ...questDetails,
      };
    })
    .filter((quest) => quest !== undefined);

  return quests;
};
