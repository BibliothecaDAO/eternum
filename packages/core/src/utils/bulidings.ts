import { getComponentValue } from "@dojoengine/recs";
import { ClientComponents, getEntityIdFromKeys, unpackBuildingCounts } from "..";
import { BuildingType } from "../constants/structures";
import { ID } from "../types/common";

export const getBuildingQuantity = (entityId: ID, buildingType: BuildingType, components: ClientComponents) => {
  const structureBuildings = getComponentValue(components.StructureBuildings, getEntityIdFromKeys([BigInt(entityId)]));
  const buildingCounts = unpackBuildingCounts([structureBuildings?.packed_counts_1 ?? 0n, structureBuildings?.packed_counts_2 ?? 0n, structureBuildings?.packed_counts_3 ?? 0n]);
  return buildingCounts[buildingType] || 0;
};
