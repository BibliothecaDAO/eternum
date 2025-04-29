import { type Tile } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, HasValue } from "@dojoengine/recs";
import { useDojo } from "../context";

export const useQuests = () => {
  const {
    setup: { components },
  } = useDojo();

  const tileEntitiesForQuests = useEntityQuery([HasValue(components.Tile, { occupier_type: 38 })]).map((entityId) =>
    getComponentValue(components.Tile, entityId),
  ) as Tile[];

  return tileEntitiesForQuests;
};
