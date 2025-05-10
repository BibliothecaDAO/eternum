import { TileOccupier, type Tile } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { useDojo } from "../context";

export const useQuests = () => {
  const {
    setup: { components },
  } = useDojo();

  const tileEntitiesForQuests = useEntityQuery([HasValue(components.Tile, { occupier_type: TileOccupier.Quest })]).map(
    (entityId) => getComponentValue(components.Tile, entityId),
  ) as Tile[];

  return tileEntitiesForQuests;
};

export const useGetQuestForExplorer = (explorerId: number, questTileId: number) => {
  const {
    setup: { components },
  } = useDojo();
  const entity = useEntityQuery([
    Has(components.Quest),
    HasValue(components.Quest, { explorer_id: explorerId, quest_tile_id: questTileId }),
  ]);

  return entity.values().next().value!;
};
