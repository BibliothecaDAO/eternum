import { useEntityQuery } from "@dojoengine/react";
import { HasValue, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context";

export const useQuests = () => {
  const {
    setup: { components },
  } = useDojo();

  const questTileEntities = useEntityQuery([HasValue(components.QuestTile, {})]);

  // Map the entities to their quest tiles
  const quests = questTileEntities
    .map((entity) => {
      const questTile = getComponentValue(components.QuestTile, entity);
      return {
        entityId: entity,
        ...questTile,
      };
    })
    .filter((quest) => quest !== undefined);

  return quests;
};
