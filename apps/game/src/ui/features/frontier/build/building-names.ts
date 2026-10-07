import { BARRACKS, FARM, HUT, WORKSHOP } from "@/ui/design-system/kit/words";
import { BuildingType } from "@bibliothecadao/types";

/** Frontier's buildings by their glossary names, the only words its build, upgrade and research sheets show. */
const NAMES: Partial<Record<BuildingType, string>> = {
  [BuildingType.ResourceWheat]: FARM,
  [BuildingType.ResourceKnightT1]: BARRACKS,
  [BuildingType.ResourceLabor]: WORKSHOP,
  // No storage building in the ruled design; the name stays while next's contracts still raise one.
  [BuildingType.Storehouse]: "Storehouse",
  [BuildingType.WorkersHut]: HUT,
};

/** A Frontier building's name; a building Frontier does not raise is loud. */
export const buildingName = (category: BuildingType): string => {
  const name = NAMES[category];
  if (!name) throw new Error(`Frontier has no building ${category}`);
  return name;
};
