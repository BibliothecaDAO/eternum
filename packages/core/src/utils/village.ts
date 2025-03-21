import { getComponentValue } from "@dojoengine/recs";
import { getNeighborHexes, Steps } from "../constants";
import { ClientComponents } from "../dojo";
import { ID } from "../types";
import { getEntityIdFromKeys } from "./utils";

export const getFreeVillagePositions = (realmEntityId: ID, components: ClientComponents) => {
  const structureBase = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(realmEntityId)]))?.base;
  if (!structureBase) return [];

  const freePositions = [];

  const neighborHexes = getNeighborHexes(structureBase.coord_x, structureBase.coord_y, Steps.Two);

  for (const hex of neighborHexes) {
    const tile = getComponentValue(components.Tile, getEntityIdFromKeys([BigInt(hex.col), BigInt(hex.row)]));
    if (!tile?.occupier_is_structure) freePositions.push(hex);
  }

  return freePositions;
};
