import type { ClientComponents, ID } from "@bibliothecadao/types";
import { type Entity, Has, HasValue, type QueryFragment } from "@dojoengine/recs";

/** The quest an explorer holds on one quest tile; the pair is unique, so the query yields at most one entity. */
export const questForExplorerQuery = (
  components: ClientComponents,
  explorerId: ID,
  questTileId: ID,
): QueryFragment[] => [
  Has(components.Quest),
  HasValue(components.Quest, { explorer_id: explorerId, quest_tile_id: questTileId }),
];

export const readQuestEntity = (entities: Entity[]): Entity | undefined => entities[0];
