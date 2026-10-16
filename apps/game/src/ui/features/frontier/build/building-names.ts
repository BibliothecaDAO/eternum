import { type IconMeaning } from "@/ui/design-system/icon";
import { BARRACKS, FARM, HUT, TRAINING_BUILDINGS, WORKSHOP } from "@/ui/design-system/kit/words";

import { BuildingType } from "@bibliothecadao/types";

/** Frontier's buildings by their glossary names and icons, the only ones its build, upgrade and research sheets show. */
const NAMES: Partial<Record<BuildingType, string>> = {
  [BuildingType.ResourceWheat]: FARM,
  [BuildingType.ResourceKnightT1]: BARRACKS,
  [BuildingType.ResourceLabor]: WORKSHOP,
  [BuildingType.WorkersHut]: HUT,
  [BuildingType.WarHall]: TRAINING_BUILDINGS[0],
  [BuildingType.SupplyYard]: TRAINING_BUILDINGS[1],
  [BuildingType.ScoutsLodge]: TRAINING_BUILDINGS[2],
  [BuildingType.Hearth]: TRAINING_BUILDINGS[3],
};

/** The name of a building read off the chain, where it is one Frontier raises. */
export const frontierBuildingName = (category: number): string | undefined => NAMES[category as BuildingType];

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
