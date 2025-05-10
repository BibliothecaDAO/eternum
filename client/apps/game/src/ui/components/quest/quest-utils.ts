import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";

export const useGetQuests = (gameAddress: string, questTileId: number) => {
  const {
    setup: { components },
  } = useDojo();
  const gameIdsQueryFrament = useMemo(
    () =>
      !!questTileId
        ? [
            Has(components.Quest),
            HasValue(components.Quest, {
              game_address: gameAddress,
              quest_tile_id: questTileId,
            }),
          ]
        : [HasValue(components.Quest, { game_address: "0x0" })],
    [components, gameAddress, questTileId],
  );

  const questEntities = useEntityQuery([...gameIdsQueryFrament]);

  const quests = useMemo(() => {
    return questEntities.map((questEntity) => {
      return getComponentValue(components.Quest, questEntity);
    });
  }, [components, questEntities]);

  return quests;
};
