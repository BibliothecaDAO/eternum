import { knownAmount } from "@/ui/utils/utils";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { GameModeConfig } from "@/config/game-modes";
import type { ResourceRequirement } from "@/ui/design-system/molecules/requirement-chips";
import { getBalance, getBuildingCosts } from "@bibliothecadao/eternum";
import { BuildingType, getBuildingFromResource, isEconomyBuilding, type ResourcesIds } from "@bibliothecadao/types";
import {
  getMilitaryBuildingInfo,
  MILITARY_BUILDING_GROUP_ORDER,
  type MilitaryBuildingGroup,
} from "./realm-building-summary";

/** The catalogue and plot picker share allowed buildings and their group order. */
export function resolveBuildingRequirements(
  entityId: number,
  store: NativeFactStore,
  type: BuildingType,
  useSimpleCost: boolean,
  currentDefaultTick: number,
): ResourceRequirement[] | undefined {
  return getBuildingCosts(entityId, store, type, useSimpleCost)?.map((cost) => ({
    resource: cost.resource,
    amount: cost.amount,
    current: knownAmount(getBalance(entityId, cost.resource, currentDefaultTick, store).balance),
  }));
}

/**
 * A group's fixed places, where it has them: a column a line (a resource's line, or a troop type with its head), a row
 * a tier, top to bottom; a building the realm cannot have leaves its cell empty (null), so nothing ever moves.
 */
export interface ConstructionGrid {
  heads?: MilitaryBuildingGroup[];
  rows: (BuildingType | null)[][];
}

export interface ConstructionGroup {
  label: string;
  buildings: BuildingType[];
  grid?: ConstructionGrid;
}

export function getConstructionBuildingGroups(
  mode: Pick<GameModeConfig, "rules" | "resources">,
  resources: ResourcesIds[],
): ConstructionGroup[] {
  const allowed = Object.values(BuildingType).filter(
    (type): type is BuildingType => typeof type === "number" && mode.rules.isBuildingTypeAllowed(BuildingType[type]),
  );
  const resourceBuildings = [...new Set(resources.map(getBuildingFromResource))].filter(
    (type) => allowed.includes(type) && type !== BuildingType.None,
  );
  const military = allowed
    .filter((type) => getMilitaryBuildingInfo(type) != null)
    .toSorted((a, b) => militaryRank(a) - militaryRank(b));
  const groups: ConstructionGroup[] = [
    { label: "Resources", buildings: resourceBuildings, grid: resourceGrid(mode, resourceBuildings) },
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
    { label: "Military", buildings: military, grid: militaryGrid(military) },
  ];
  return groups.filter((group) => group.buildings.length > 0);
}

/**
 * The resource buildings in their lines, where the mode's resources run in lines (Blitz's materials, three to a tier:
 * Wood → Ironwood → Adamantine, Coal → Cold Iron → Mithral, Copper → Gold → Dragonhide; each T3's recipe costs its
 * line's T2). A mode without lines keeps the realm's own order, never re-sorted.
 */
function resourceGrid(
  mode: Pick<GameModeConfig, "resources">,
  buildings: BuildingType[],
): ConstructionGrid | undefined {
  const tiers = mode.resources.getTiers();
  if (!("materials" in tiers)) return undefined;
  const lines = 3;
  return {
    rows: Array.from({ length: tiers.materials.length / lines }, (_, tier) =>
      Array.from({ length: lines }, (_, line) => {
        const building = getBuildingFromResource(tiers.materials[tier * lines + line]);
        return buildings.includes(building) ? building : null;
      }),
    ),
  };
}

/** The troop buildings as one army: a troop type a column (Paladin, Knight, Crossbowman), a tier a row. */
function militaryGrid(buildings: BuildingType[]): ConstructionGrid {
  const at = (type: MilitaryBuildingGroup, tier: number) =>
    buildings.find((building) => {
      const info = getMilitaryBuildingInfo(building);
      return info?.type === type && info.tier === tier;
    }) ?? null;
  return {
    heads: [...MILITARY_BUILDING_GROUP_ORDER],
    rows: [1, 2, 3].map((tier) => MILITARY_BUILDING_GROUP_ORDER.map((type) => at(type, tier))),
  };
}

/** Troop buildings read as one army: by troop type in the summary's order, then by tier. */
function militaryRank(type: BuildingType): number {
  const info = getMilitaryBuildingInfo(type)!;
  return MILITARY_BUILDING_GROUP_ORDER.indexOf(info.type) * 10 + info.tier;
}
