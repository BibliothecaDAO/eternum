import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys, unpackValue } from "..";
import { ID, BuildingType, ClientComponents } from "@bibliothecadao/types";

export const getBuildingQuantity = (entityId: ID, buildingType: BuildingType, components: ClientComponents) => {
  const structureBuildings = getComponentValue(components.StructureBuildings, getEntityIdFromKeys([BigInt(entityId)]));
  const buildingCounts = unpackValue(structureBuildings?.packed_counts || 0n);
  return buildingCounts[buildingType] || 0;
};
