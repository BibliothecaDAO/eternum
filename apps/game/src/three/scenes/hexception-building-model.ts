import { ResourceIdToMiningType, StructureProgress } from "@bibliothecadao/eternum";
import {
  BUILDINGS_CENTER,
  BuildingType,
  BuildingTypeToString,
  RealmLevels,
  ResourceMiningTypes,
  ResourcesIds,
  StructureType,
  structureName,
} from "@bibliothecadao/types";
import { byStructureCategory } from "@/lib/structure-category-table";
import { isVillageLikeStructureCategory } from "@/lib/structure-type-utils";
import {
  BUILDINGS_GROUPS,
  type BUILDINGS_CATEGORIES_TYPES,
  castleLevelToRealmCastle,
  hyperstructureStageToModel,
} from "../constants/scene-constants";
import { buildingTierModelPath } from "../structures/building-tiers";
import { REALM_PATHS, realmModelIndex } from "../structures/realm-design";

interface BoardBuilding {
  category: BUILDINGS_CATEGORIES_TYPES;
  col: number;
  row: number;
  resource?: ResourcesIds;
  structureType?: StructureType | null;
  tier?: number;
}

/** Labor is shared by Workshops and the board's keep; position identifies the keep. */
function isCentralKeep(building: BoardBuilding): boolean {
  return building.col === BUILDINGS_CENTER[0] && building.row === BUILDINGS_CENTER[1];
}

export interface BuildingModelSelection {
  group: BUILDINGS_GROUPS;
  type: BUILDINGS_CATEGORIES_TYPES;
  /** The tier's own model, for a building upgraded past tier I. */
  tierPath?: string;
}

/**
 * What the keep on a structure's board is called, by the structure's category: the realm's castle by its level, the
 * game mode's word for a village, or a name of its own. A new category fails typecheck here until it has one.
 */
const KEEP_NAMES: Record<StructureType, string> = {
  [StructureType.Realm]: "realm-castle",
  [StructureType.Village]: "village",
  [StructureType.Camp]: "village",
  [StructureType.Bank]: "Bank",
  [StructureType.Hyperstructure]: "Hyperstructure",
  [StructureType.Mine]: "Mine",
  [StructureType.BitcoinMine]: "Mine",
  [StructureType.Rift]: "Rift",
  [StructureType.Ruin]: "Ruin",
  [StructureType.Beasts]: "Beasts",
};

export function getBuildingDisplayName(
  building: BoardBuilding,
  stage: RealmLevels | StructureProgress,
  villageLabel: string,
): string {
  const buildingType = building.category as BuildingType;

  if (buildingType === BuildingType.None) {
    return "Empty";
  }

  if (buildingType === BuildingType.ResourceAncientFragment) {
    return structureName(StructureType.Mine, 2);
  }

  if (buildingType === BuildingType.ResourceLabor) {
    if (!isCentralKeep(building)) return "Workshop";
    // The board of a structure whose category is not known yet shows a plain keep.
    if (building.structureType == null) return "Castle";
    const keep = byStructureCategory(KEEP_NAMES, building.structureType, "keep name", "Castle");
    if (keep === "realm-castle") return castleLevelToRealmCastle[stage as RealmLevels] ?? "Castle";
    return keep === "village" ? villageLabel : keep;
  }

  const baseName = BuildingTypeToString[buildingType];
  if (!baseName) {
    return "Building";
  }

  if (baseName.endsWith(" Resource")) {
    return baseName.replace(" Resource", "");
  }

  return baseName;
}

export function resolveBuildingModelSelection(
  building: BoardBuilding,
  context: {
    stage: RealmLevels | StructureProgress;
    structureId: number;
    mainStructureType?: StructureType;
    wonder: boolean;
  },
): BuildingModelSelection {
  const { stage, structureId, mainStructureType, wonder } = context;
  let group: BUILDINGS_GROUPS;
  let type: BUILDINGS_CATEGORIES_TYPES;

  if (building.resource && (building.resource < 23 || building.resource === ResourcesIds.AncientFragment)) {
    group = BUILDINGS_GROUPS.RESOURCES_MINING;
    type = ResourceIdToMiningType[building.resource] as ResourceMiningTypes;
  } else {
    group = BUILDINGS_GROUPS.BUILDINGS;
    type = building.category;
  }

  if (group === BUILDINGS_GROUPS.BUILDINGS && type === BuildingType.ResourceLabor && isCentralKeep(building)) {
    group = BUILDINGS_GROUPS.REALMS;
    type = castleLevelToRealmCastle[stage];
  }

  const isCenterBuilding = isCentralKeep(building);
  if (isCenterBuilding && isVillageLikeStructureCategory(mainStructureType)) {
    group = BUILDINGS_GROUPS.VILLAGE;
    type = mainStructureType as StructureType.Village | StructureType.Camp;
  }

  if (building.structureType === StructureType.Hyperstructure) {
    group = BUILDINGS_GROUPS.HYPERSTRUCTURE;
    type = hyperstructureStageToModel[stage as StructureProgress];
  }

  const tierPath =
    group === BUILDINGS_GROUPS.REALMS && wonder
      ? REALM_PATHS[realmModelIndex(stage, true, structureId)]
      : group === BUILDINGS_GROUPS.BUILDINGS
        ? buildingTierModelPath(type as BuildingType, building.tier)
        : undefined;
  return { group, type, tierPath };
}
