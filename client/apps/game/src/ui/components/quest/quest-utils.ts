import { ClientComponents } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";

export const getQuests = (components: ClientComponents, gameAddress: string, questTileId: number) => {
  const gameIdsQueryFrament = !!questTileId
    ? [
        Has(components.Quest),
        HasValue(components.Quest, {
          game_address: gameAddress,
          quest_tile_id: questTileId,
        }),
      ]
    : [HasValue(components.Quest, { game_address: "0x0" })];

  const questEntities = useEntityQuery([...gameIdsQueryFrament]);

  const quests = questEntities.map((questEntity) => {
    return getComponentValue(components.Quest, questEntity);
  });
  return quests;
};

/**
 * Gets the current quest for an explorer
 */
export const getQuestForExplorer = (components: ClientComponents, explorerId: number, questTileId: number) => {
  const entity = useEntityQuery([
    Has(components.Quest),
    HasValue(components.Quest, { explorer_id: explorerId, quest_tile_id: questTileId }),
  ]);

  return entity.values().next().value!;
};
