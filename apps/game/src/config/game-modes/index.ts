import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { configManager, getEntityInfo, getStructureName, nativeGameModeOfFamily } from "@bibliothecadao/eternum";
import {
  BuildingType,
  isFrontierBuilding,
  type ContractAddress,
  type ID,
  StructureType,
  getResourceTiers,
  structureName,
  structurePlural,
} from "@bibliothecadao/types";
import { BUILDINGS_GROUPS, buildingModelPaths, getStructureModelPaths } from "@/three/constants/scene-constants";
import { frontierPaintedBuildingPath, frontierPaintedPath } from "@/three/structures/frontier-painted-buildings";
import { FRONTIER_CAMP_MODEL_PATH } from "@/three/structures/frontier-beast";

export type GameModeId = "frontier" | "blitz" | "eternum";

export interface GameModeConfig {
  id: GameModeId;
  displayName: string;
  labels: {
    realm: string;
    realms: string;
    village: string;
    villages: string;
  };
  audio: {
    tickGongSound: string;
  };
  ui: {
    showExplorerCapacity: boolean;
    showGuildsTab: boolean;
    showAutomation: boolean;
    /**
     * The build pickers beside a plot's own sheet: the scene's popover on an empty plot and the realm menu's
     * Construction entry. Frontier builds only from its build sheet on a tapped plot.
     */
    showBuildMenus: boolean;
  };
  resources: {
    getTiers: () => ReturnType<typeof getResourceTiers>;
  };
  rules: {
    isBuildingTypeAllowed: (key: string) => boolean;
  };
  structure: {
    getName: typeof getStructureName;
    getTypeName: (structureType: StructureType, mineKind?: number) => string | undefined;
    getEntityInfo: (
      entityId: ID,
      playerAccount: ContractAddress | null,
      store: NativeFactStore,
    ) => ReturnType<typeof getEntityInfo>;
  };
  assets: {
    structureModelPaths: ReturnType<typeof getStructureModelPaths>;
    buildingModelPaths: ReturnType<typeof resolveBuildingModelPaths>;
  };
}

const BASE_BUILDING_EXCLUSIONS = new Set<string>([
  // Frontier's training buildings stand only on its realm boards.
  "RationsDepot",
  "SupplyYard",
  "ScoutsLodge",
  "ConscriptionCamp",
  "Resource",
  "Castle",
  "Bank",
  "FragmentMine",
  "None",
  "Settlement",
  "Hyperstructure",
  "Storehouse",
]);

const BLITZ_BUILDING_EXCLUSIONS = new Set<keyof typeof BuildingType>(["ResourceFish", "ResourceResearch"]);

function resolveBuildingModelPaths(isBlitz: boolean) {
  const paths = buildingModelPaths();
  const buildings: Partial<Record<BuildingType, string>> = { ...paths[BUILDINGS_GROUPS.BUILDINGS] };
  if (isBlitz) {
    for (const building of BLITZ_BUILDING_EXCLUSIONS) delete buildings[BuildingType[building]];
  }
  return { ...paths, [BUILDINGS_GROUPS.BUILDINGS]: buildings };
}

const buildStructureHelpers = () => ({
  // A mode names the active game's structures, from the active game's facts.
  getName: getStructureName,
  getTypeName: (type: StructureType, mineKind?: number) => structureName(type, mineKind),
  getEntityInfo: (entityId: ID, playerAccount: ContractAddress | null, store: NativeFactStore) =>
    getEntityInfo(entityId, playerAccount, store),
});

const buildBuildingRule = (extraExclusions: Set<string>) => (key: string) => {
  if (!key || !Number.isNaN(Number(key))) return false;
  if (BASE_BUILDING_EXCLUSIONS.has(key)) return false;
  if (extraExclusions.has(key)) return false;
  return key in BuildingType;
};

const blitzConfig: GameModeConfig = {
  id: "blitz",
  displayName: "Blitz",
  labels: {
    realm: "Realm",
    realms: "Realms",
    village: "Camp",
    villages: "Camps",
  },
  audio: {
    tickGongSound: "event.blitz_gong",
  },
  ui: {
    showExplorerCapacity: false,
    showGuildsTab: false,
    showAutomation: true,
    showBuildMenus: true,
  },
  resources: {
    getTiers: () => getResourceTiers(true),
  },
  rules: {
    isBuildingTypeAllowed: buildBuildingRule(BLITZ_BUILDING_EXCLUSIONS),
  },
  structure: buildStructureHelpers(),
  assets: {
    structureModelPaths: getStructureModelPaths(),
    buildingModelPaths: resolveBuildingModelPaths(true),
  },
};

const eternumConfig: GameModeConfig = {
  id: "eternum",
  displayName: "Eternum",
  labels: {
    realm: "Realm",
    realms: "Realms",
    village: "Village",
    villages: "Villages",
  },
  audio: {
    tickGongSound: "event.gong",
  },
  ui: {
    showExplorerCapacity: true,
    showGuildsTab: true,
    showAutomation: true,
    showBuildMenus: true,
  },
  resources: {
    getTiers: () => getResourceTiers(false),
  },
  rules: {
    isBuildingTypeAllowed: buildBuildingRule(new Set()),
  },
  structure: buildStructureHelpers(),
  assets: {
    structureModelPaths: getStructureModelPaths(),
    buildingModelPaths: resolveBuildingModelPaths(false),
  },
};

const frontierConfig: GameModeConfig = {
  ...blitzConfig,
  id: "frontier",
  displayName: "Frontier",
  assets: {
    buildingModelPaths: frontierBuildingModels(),
    structureModelPaths: frontierStructureModels(),
  },
  structure: buildStructureHelpers(),
  labels: {
    ...blitzConfig.labels,
    village: structureName(StructureType.Camp),
    villages: structurePlural(StructureType.Camp),
  },
  ui: {
    ...blitzConfig.ui,
    showAutomation: false,
    showBuildMenus: false,
    // A Frontier session opens on the realm, where the day's first build and deploy happen.
  },
  resources: {
    getTiers: blitzConfig.resources.getTiers,
  },
  rules: {
    isBuildingTypeAllowed: (key) =>
      Object.entries(BuildingType).some(
        ([name, value]) => name === key && typeof value === "number" && isFrontierBuilding(value),
      ),
  },
};

function frontierBuildingModels() {
  const paths = resolveBuildingModelPaths(true);
  for (const key of Object.keys(paths[BUILDINGS_GROUPS.BUILDINGS])) {
    const type = Number(key) as BuildingType;
    const painted = frontierPaintedBuildingPath(type);
    if (painted) paths[BUILDINGS_GROUPS.BUILDINGS][type] = painted;
  }
  paths[BUILDINGS_GROUPS.BUILDINGS][BuildingType.ResourceEssence] = frontierPaintedPath("essence-rift");
  return paths;
}

function frontierStructureModels() {
  const paths = getStructureModelPaths();
  paths[StructureType.Camp] = [FRONTIER_CAMP_MODEL_PATH, ...paths[StructureType.Camp].slice(1)];
  paths[StructureType.Rift] = [frontierPaintedPath("essence-rift"), ...paths[StructureType.Rift].slice(1)];
  return paths;
}
const GAME_MODE_CONFIGS: Record<GameModeId, GameModeConfig> = {
  frontier: frontierConfig,
  blitz: blitzConfig,
  eternum: eternumConfig,
};

export function getGameModeConfig(family = configManager.getFamily()): GameModeConfig {
  return GAME_MODE_CONFIGS[nativeGameModeOfFamily(family)];
}
export const getGameModeId = (): GameModeId => getGameModeConfig().id;
