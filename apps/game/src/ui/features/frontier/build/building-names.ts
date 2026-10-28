import { buildingMeaning } from "@/ui/design-system/domain-icon-meaning";
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

/** A Frontier building's icon, as every game paints it; a building Frontier does not raise is loud. */
export const buildingIcon = (category: BuildingType): IconMeaning => {
  if (!isFrontierBuilding(category)) throw new Error(`Frontier has no building ${category}`);
  return buildingMeaning(category, true);
};
