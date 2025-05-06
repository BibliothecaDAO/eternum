import { ClientComponents } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { GameScore } from "metagame-sdk";

export const getQuests = (components: ClientComponents, gameAddress: string, scores: GameScore[]) => {
  const gameIdsQueryFrament =
    scores.length > 0
      ? [
          Has(components.Quest),
          ...scores.map((score) =>
            HasValue(components.Quest, {
              game_address: gameAddress,
              game_token_id: BigInt(score.token_id),
            }),
          ),
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
