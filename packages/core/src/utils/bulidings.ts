import { getComponentValue } from "@dojoengine/recs";
import { ClientComponents, getEntityIdFromKeys, unpackValue } from "..";
import { BuildingType } from "../constants/structures";
import { ID } from "../types/common";

export const getBuildingQuantity = (entityId: ID, buildingType: BuildingType, components: ClientComponents) => {
  const structureBuildings = getComponentValue(components.StructureBuildings, getEntityIdFromKeys([BigInt(entityId)]));
  const buildingCounts = unpackValue(structureBuildings?.building_count || 0n);
  return buildingCounts[buildingType] || 0;
};
