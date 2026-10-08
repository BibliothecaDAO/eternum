import { BARRACKS, FARM, HUT, TRAINING_BUILDINGS, WORKSHOP } from "@/ui/design-system/kit/words";
import { BuildingType } from "@bibliothecadao/types";

/** Frontier's buildings by their glossary names, the only words its build, upgrade and research sheets show. */
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
