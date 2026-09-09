import type { GameModeConfig } from "@/config/game-modes";
import { BuildingType, getBuildingFromResource, isEconomyBuilding, type ResourcesIds } from "@bibliothecadao/types";
import { getMilitaryBuildingInfo, MILITARY_BUILDING_GROUP_ORDER } from "./realm-building-summary";

/** The catalogue and plot picker share allowed buildings and their group order. */
export function getConstructionBuildingGroups(mode: Pick<GameModeConfig, "rules">, resources: ResourcesIds[]) {
  const allowed = Object.values(BuildingType).filter(
    (type): type is BuildingType => typeof type === "number" && mode.rules.isBuildingTypeAllowed(BuildingType[type]),
  );
  return [
    {
      label: "Resources",
      buildings: [...new Set(resources.map(getBuildingFromResource))].filter(
        (type) => allowed.includes(type) && type !== BuildingType.None,
      ),
    },
    {
      label: "Economic",
      buildings: allowed
        .filter(isEconomyBuilding)
        .toSorted(
          (a, b) =>
            (a === BuildingType.ResourceWheat ? -2 : a === BuildingType.ResourceFish ? -1 : 0) -
            (b === BuildingType.ResourceWheat ? -2 : b === BuildingType.ResourceFish ? -1 : 0),
        ),
    },
    ...MILITARY_BUILDING_GROUP_ORDER.map((label) => ({
      label,
      buildings: allowed
        .filter((type) => getMilitaryBuildingInfo(type)?.type === label)
        .toSorted((a, b) => getMilitaryBuildingInfo(a)!.tier - getMilitaryBuildingInfo(b)!.tier),
    })),
  ].filter((group) => group.buildings.length > 0);
}
