import { BuildingType } from "@bibliothecadao/types";

/** Frontier's names for its buildings: proper names, the only words its build, upgrade and research sheets show. */
export const FRONTIER_BUILDING_NAMES: Partial<Record<BuildingType, string>> = {
  [BuildingType.ResourceWheat]: "Farm",
  [BuildingType.ResourceKnightT1]: "Barracks",
  [BuildingType.ResourceLabor]: "Workshop",
  [BuildingType.Storehouse]: "Storehouse",
  [BuildingType.WorkersHut]: "Hut",
};
