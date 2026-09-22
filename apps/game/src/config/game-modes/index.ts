import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { configManager, getEntityInfo, getStructureName, getStructureTypeName } from "@bibliothecadao/eternum";
import {
  BuildingType,
  type ContractAddress,
  type ID,
  ResourcesIds,
  StructureType,
  getResourceTiers,
} from "@bibliothecadao/types";
import { BUILDINGS_GROUPS, buildingModelPaths, getStructureModelPaths } from "@/three/constants/scene-constants";

export type GameModeId = "frontier" | "blitz" | "eternum" | "duel";

export type VillageIconKey = "castle" | "tent";

type StructureNameInput = Parameters<typeof getStructureName>[0];

export interface GameModeConfig {
  id: GameModeId;
  displayName: string;
  labels: {
    realm: string;
    realms: string;
    village: string;
    villages: string;
    timelineSubject: string;
    shareEventLabel: string;
    endgameCardTitle: string;
    endgameCardSubtitle: string;
  };
  audio: {
    trackArtist: string;
    tickGongSound: string;
  };
  ui: {
    showAttackTypeSelector: boolean;
    showEndSeasonButton: boolean;
    showExplorerCapacity: boolean;
    villageIconKey: VillageIconKey;
    showTradeMenu: boolean;
    showGuildsTab: boolean;
    showAutomation: boolean;
    /** Shown on the army muster when the mode spends committed troops for good. */
    musterNotice: string | null;
  };
  resources: {
    getTiers: () => ReturnType<typeof getResourceTiers>;
    canManageResource: (resourceId: ResourcesIds) => boolean;
    canShowProductionShortcut: (resourceId: ResourcesIds) => boolean;
  };
  rules: {
    isBuildingTypeAllowed: (key: string) => boolean;
    autoAllocateHyperstructureShares: boolean;
    /** Whether resources move between a player's structures at all; Frontier sends every find straight home. */
    allowsTransfers: boolean;
  };
  structure: {
    getName: (
      structure: StructureNameInput,
      parentRealmContractPosition?: { col: number; row: number },
    ) => ReturnType<typeof getStructureName>;
    getTypeName: (structureType: StructureType, mineKind?: number) => string | undefined;
    getEntityInfo: (
      entityId: ID,
      playerAccount: ContractAddress,
      store: NativeFactStore,
    ) => ReturnType<typeof getEntityInfo>;
  };
  assets: {
    structureModelPaths: ReturnType<typeof getStructureModelPaths>;
    buildingModelPaths: ReturnType<typeof resolveBuildingModelPaths>;
  };
}

const BASE_BUILDING_EXCLUSIONS = new Set<string>([
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

const BLITZ_UNMANAGEABLE_RESOURCES = new Set<ResourcesIds>([ResourcesIds.Labor, ResourcesIds.Wheat]);

function resolveBuildingModelPaths(isBlitz: boolean) {
  const paths = buildingModelPaths(isBlitz);
  const buildings: Partial<Record<BuildingType, string>> = { ...paths[BUILDINGS_GROUPS.BUILDINGS] };
  if (isBlitz) {
    for (const building of BLITZ_BUILDING_EXCLUSIONS) delete buildings[BuildingType[building]];
  }
  return { ...paths, [BUILDINGS_GROUPS.BUILDINGS]: buildings };
}

const buildStructureHelpers = (isBlitz: boolean) => ({
  getName: (structure: StructureNameInput, parentRealmContractPosition?: { col: number; row: number }) =>
    getStructureName(structure, isBlitz, parentRealmContractPosition),
  getTypeName: getStructureTypeName,
  getEntityInfo: (entityId: ID, playerAccount: ContractAddress, store: NativeFactStore) =>
    getEntityInfo(entityId, playerAccount, store, isBlitz),
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
    timelineSubject: "Game",
    shareEventLabel: "Realms Blitz",
    endgameCardTitle: "Realms Blitz",
    endgameCardSubtitle: "Blitz Leaderboard",
  },
  audio: {
    trackArtist: "The Minstrels",
    tickGongSound: "event.blitz_gong",
  },
  ui: {
    showAttackTypeSelector: false,
    showEndSeasonButton: false,
    showExplorerCapacity: false,
    villageIconKey: "tent",
    showTradeMenu: false,
    showGuildsTab: false,
    showAutomation: true,
    musterNotice: null,
  },
  resources: {
    getTiers: () => getResourceTiers(true),
    canManageResource: (resourceId) => !BLITZ_UNMANAGEABLE_RESOURCES.has(resourceId),
    canShowProductionShortcut: (resourceId) => !BLITZ_UNMANAGEABLE_RESOURCES.has(resourceId),
  },
  rules: {
    isBuildingTypeAllowed: buildBuildingRule(BLITZ_BUILDING_EXCLUSIONS),
    autoAllocateHyperstructureShares: true,
    allowsTransfers: true,
  },
  structure: buildStructureHelpers(true),
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
    timelineSubject: "Season",
    shareEventLabel: "the Realms leaderboard",
    endgameCardTitle: "Realms",
    endgameCardSubtitle: "Final Leaderboard",
  },
  audio: {
    trackArtist: "Casey Wescott",
    tickGongSound: "event.gong",
  },
  ui: {
    showAttackTypeSelector: true,
    showEndSeasonButton: true,
    showExplorerCapacity: true,
    villageIconKey: "castle",
    showTradeMenu: true,
    showGuildsTab: true,
    showAutomation: true,
    musterNotice: null,
  },
  resources: {
    getTiers: () => getResourceTiers(false),
    canManageResource: () => true,
    canShowProductionShortcut: () => true,
  },
  rules: {
    isBuildingTypeAllowed: buildBuildingRule(new Set()),
    autoAllocateHyperstructureShares: false,
    allowsTransfers: true,
  },
  structure: buildStructureHelpers(false),
  assets: {
    structureModelPaths: getStructureModelPaths(),
    buildingModelPaths: resolveBuildingModelPaths(false),
  },
};

const frontierConfig: GameModeConfig = {
  ...blitzConfig,
  id: "frontier",
  displayName: "Frontier",
  labels: {
    ...blitzConfig.labels,
    timelineSubject: "Season",
    shareEventLabel: "Realms Frontier",
    endgameCardTitle: "Realms Frontier",
    endgameCardSubtitle: "Season Results",
  },
  ui: {
    ...blitzConfig.ui,
    showAutomation: false,
    musterNotice: "Committed troops do not return. What you send today is spent today, win or lose.",
  },
  resources: {
    getTiers: blitzConfig.resources.getTiers,
    canManageResource: () => false,
    canShowProductionShortcut: () => false,
  },
  rules: {
    isBuildingTypeAllowed: (key) =>
      ["WorkersHut", "Storehouse", "ResourceWheat", "ResourceKnightT1", "ResourceLabor"].includes(key),
    autoAllocateHyperstructureShares: false,
    allowsTransfers: false,
  },
};
const duelConfig: GameModeConfig = {
  ...blitzConfig,
  id: "duel",
  displayName: "Duel",
  labels: { ...blitzConfig.labels, shareEventLabel: "Realms Duel", endgameCardTitle: "Realms Duel" },
};
const GAME_MODE_BY_ID: Record<number, GameModeConfig> = {
  1: frontierConfig,
  2: blitzConfig,
  3: eternumConfig,
  4: duelConfig,
};

export function getGameModeConfig(presetId = configManager.getPresetId()): GameModeConfig {
  const config = GAME_MODE_BY_ID[presetId];
  if (!config) throw new Error(`Unknown native preset ${presetId}`);
  return config;
}
export const getGameModeId = (): GameModeId => getGameModeConfig().id;
