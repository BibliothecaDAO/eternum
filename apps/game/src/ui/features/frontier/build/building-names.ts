import { BARRACKS, FARM, HUT, TRAINING_BUILDINGS, WORKSHOP } from "@/ui/design-system/kit/words";
import type { IconCode } from "@/ui/design-system/kit/kit-icon";
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

/** A Frontier building's name; a building Frontier does not raise is loud. */
export const buildingName = (category: BuildingType): string => {
  const name = NAMES[category];
  if (!name) throw new Error(`Frontier has no building ${category}`);
  return name;
};

const ICONS: Partial<Record<BuildingType, IconCode>> = {
  [BuildingType.ResourceWheat]: "Fm",
  [BuildingType.ResourceLabor]: "Wk",
  [BuildingType.ResourceKnightT1]: "Bs",
  [BuildingType.WorkersHut]: "Ht",
  [BuildingType.WarHall]: "Wa",
  [BuildingType.SupplyYard]: "Sy",
  [BuildingType.ScoutsLodge]: "Ld",
  [BuildingType.Hearth]: "He",
};

/** A Frontier building's icon; a building Frontier does not raise is loud. */
export const buildingIcon = (category: BuildingType): IconCode => {
  const icon = ICONS[category];
  if (!icon) throw new Error(`Frontier has no building ${category}`);
  return icon;
};
