import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue } from "@dojoengine/recs";
import { useDojo } from "../context";

// export const useQuests = () => {
//   const {
//     setup: { components },
//   } = useDojo();

//   const tileEntitiesForQuests = useEntityQuery([HasValue(components.TileOpt, { occupier_type: TileOccupier.Quest })]).map(
//     (entityId) => {
//       const tileOpt = getComponentValue(components.TileOpt, entityId);
//       return tileOpt ? tileOptToTile(tileOpt) : undefined;
//     },
//   ).filter(Boolean) as Tile[];

//   return tileEntitiesForQuests;
// };

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
