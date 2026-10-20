import { type IconMeaning } from "@/ui/design-system/icon";

import { BuildingType, buildingName as nameOfBuilding, isFrontierBuilding } from "@bibliothecadao/types";

/** The name of a building read off the chain, where it is one Frontier raises. */
export const frontierBuildingName = (category: number): string | undefined =>
  isFrontierBuilding(category) ? nameOfBuilding(category, true) : undefined;

/** A Frontier building's name; a building Frontier does not raise is loud. */
export const buildingName = (category: BuildingType): string => {
  const name = frontierBuildingName(category);
  if (!name) throw new Error(`Frontier has no building ${category}`);
  return name;
};

const ICONS: Partial<Record<BuildingType, IconMeaning>> = {
  [BuildingType.ResourceWheat]: "farm",
  [BuildingType.ResourceLabor]: "workshop",
  [BuildingType.ResourceKnightT1]: "barracks",
  [BuildingType.WorkersHut]: "workers-hut",
  [BuildingType.WarHall]: "war-hall",
  [BuildingType.SupplyYard]: "supply-yard",
  [BuildingType.ScoutsLodge]: "scout-lodge",
  [BuildingType.Hearth]: "hearth",
};

/** A Frontier building's icon; a building Frontier does not raise is loud. */
export const buildingIcon = (category: BuildingType): IconMeaning => {
  const icon = ICONS[category];
  if (!icon) throw new Error(`Frontier has no building ${category}`);
  return icon;
};
