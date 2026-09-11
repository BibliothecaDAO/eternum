import type { GameModeConfig } from "@/config/game-modes";
import type { ResourceRequirement } from "@/ui/design-system/molecules/requirement-chips";
import { divideByPrecision, getBalance, getBuildingCosts } from "@bibliothecadao/eternum";
import {
  BuildingType,
  type ClientComponents,
  getBuildingFromResource,
  isEconomyBuilding,
  type ResourcesIds,
} from "@bibliothecadao/types";
import { getMilitaryBuildingInfo, MILITARY_BUILDING_GROUP_ORDER } from "./realm-building-summary";

/** The catalogue and plot picker share allowed buildings and their group order. */
export function resolveBuildingRequirements(
  entityId: number,
  components: ClientComponents,
  type: BuildingType,
  useSimpleCost: boolean,
  currentDefaultTick: number,
): ResourceRequirement[] {
  return (getBuildingCosts(entityId, components, type, useSimpleCost) ?? []).map((cost) => ({
    resource: cost.resource,
    amount: cost.amount,
    current: divideByPrecision(getBalance(entityId, cost.resource, currentDefaultTick, components).balance),
  }));
}

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
    {
      label: "Military",
      buildings: allowed
        .filter((type) => getMilitaryBuildingInfo(type) != null)
        .toSorted((a, b) => militaryRank(a) - militaryRank(b)),
    },
  ].filter((group) => group.buildings.length > 0);
}

/** Troop buildings read as one army: by troop type in the summary's order, then by tier. */
function militaryRank(type: BuildingType): number {
  const info = getMilitaryBuildingInfo(type)!;
  return MILITARY_BUILDING_GROUP_ORDER.indexOf(info.type) * 10 + info.tier;
}
