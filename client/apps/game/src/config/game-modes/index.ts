import { configManager, getEntityInfo, getStructureName, getStructureTypeName } from "@bibliothecadao/eternum";
import {
  BuildingType,
  type ClientComponents,
  type ContractAddress,
  type ID,
  ResourcesIds,
  StructureType,
  getResourceTiers,
} from "@bibliothecadao/types";
import { buildingModelPaths, getStructureModelPaths } from "@/three/constants/scene-constants";
import { env } from "../../../env";

export type GameModeId = "eternum" | "blitz";

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
    fragmentMine: string;
    fragmentMines: string;
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
    showMintCta: boolean;
    showTransferResourcesToTroops: boolean;
    showExplorerCapacity: boolean;
    showHyperstructureProgress: boolean;
    onboardingVariant: "eternum" | "blitz";
    villageIconKey: VillageIconKey;
    showTradeMenu: boolean;
    showBridgeMenu: boolean;
    hyperstructuresMenuVariant: "eternum" | "blitz";
    showBankToggle: boolean;
    showQuestToggle: boolean;
    showGuildsTab: boolean;
  };
  resources: {
    getTiers: () => ReturnType<typeof getResourceTiers>;
    canManageResource: (resourceId: ResourcesIds) => boolean;
    canShowProductionShortcut: (resourceId: ResourcesIds) => boolean;
  };
  rules: {
    isBuildingTypeAllowed: (key: string) => boolean;
    autoAllocateHyperstructureShares: boolean;
  };
  structure: {
    getName: (
      structure: StructureNameInput,
      parentRealmContractPosition?: { col: number; row: number },
    ) => ReturnType<typeof getStructureName>;
    getTypeName: (structureType: StructureType) => string | undefined;
    getEntityInfo: (
      entityId: ID,
      playerAccount: ContractAddress,
      components: ClientComponents,
    ) => ReturnType<typeof getEntityInfo>;
  };
  assets: {
    minimap: {
      fragmentMine: string;
    };
    labels: {
      fragmentMine: string;
    };
    structureModelPaths: ReturnType<typeof getStructureModelPaths>;
    buildingModelPaths: ReturnType<typeof buildingModelPaths>;
  };
  matches: () => boolean;
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

const BLITZ_BUILDING_EXCLUSIONS = new Set<string>(["ResourceFish", "ResourceResearch"]);

const BLITZ_UNMANAGEABLE_RESOURCES = new Set<ResourcesIds>([ResourcesIds.Labor, ResourcesIds.Wheat]);

const buildStructureHelpers = (isBlitz: boolean) => ({
  getName: (structure: StructureNameInput, parentRealmContractPosition?: { col: number; row: number }) =>
    getStructureName(structure, isBlitz, parentRealmContractPosition),
  getTypeName: (structureType: StructureType) => getStructureTypeName(structureType, isBlitz),
  getEntityInfo: (entityId: ID, playerAccount: ContractAddress, components: ClientComponents) =>
    getEntityInfo(entityId, playerAccount, components, isBlitz),
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
    fragmentMine: "Essence Rift",
    fragmentMines: "Essence Rifts",
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
    showMintCta: false,
    showTransferResourcesToTroops: false,
    showExplorerCapacity: false,
    showHyperstructureProgress: false,
    onboardingVariant: "blitz",
    villageIconKey: "tent",
    showTradeMenu: false,
    showBridgeMenu: false,
    hyperstructuresMenuVariant: "blitz",
    showBankToggle: false,
    showQuestToggle: false,
    showGuildsTab: false,
  },
  resources: {
    getTiers: () => getResourceTiers(true),
    canManageResource: (resourceId) => !BLITZ_UNMANAGEABLE_RESOURCES.has(resourceId),
    canShowProductionShortcut: (resourceId) => !BLITZ_UNMANAGEABLE_RESOURCES.has(resourceId),
  },
  rules: {
    isBuildingTypeAllowed: buildBuildingRule(BLITZ_BUILDING_EXCLUSIONS),
    autoAllocateHyperstructureShares: true,
  },
  structure: buildStructureHelpers(true),
  assets: {
    minimap: {
      fragmentMine: "/images/labels/essence_rift.png",
    },
    labels: {
      fragmentMine: "/images/labels/essence_rift.png",
    },
    structureModelPaths: getStructureModelPaths(true),
    buildingModelPaths: buildingModelPaths(true),
  },
  matches: () => Boolean(configManager.getBlitzConfig()?.blitz_mode_on),
};

const eternumConfig: GameModeConfig = {
  id: "eternum",
  displayName: "Eternum",
  labels: {
    realm: "Realm",
    realms: "Realms",
    village: "Village",
    villages: "Villages",
    fragmentMine: "Fragment Mine",
    fragmentMines: "Fragment Mines",
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
    showMintCta: true,
    showTransferResourcesToTroops: true,
    showExplorerCapacity: true,
    showHyperstructureProgress: true,
    onboardingVariant: "eternum",
    villageIconKey: "castle",
    showTradeMenu: true,
    showBridgeMenu: true,
    hyperstructuresMenuVariant: "eternum",
    showBankToggle: true,
    showQuestToggle: true,
    showGuildsTab: true,
  },
  resources: {
    getTiers: () => getResourceTiers(false),
    canManageResource: () => true,
    canShowProductionShortcut: () => true,
  },
  rules: {
    isBuildingTypeAllowed: buildBuildingRule(new Set()),
    autoAllocateHyperstructureShares: false,
  },
  structure: buildStructureHelpers(false),
  assets: {
    minimap: {
      fragmentMine: "/images/labels/fragment_mine.png",
    },
    labels: {
      fragmentMine: "/images/labels/fragment_mine.png",
    },
    structureModelPaths: getStructureModelPaths(false),
    buildingModelPaths: buildingModelPaths(false),
  },
  matches: () => true,
};

const GAME_MODE_ORDER: GameModeConfig[] = [blitzConfig, eternumConfig];
const GAME_MODE_BY_ID: Record<GameModeId, GameModeConfig> = {
  blitz: blitzConfig,
  eternum: eternumConfig,
};
const FORCED_GAME_MODE_ID: GameModeId | undefined = env.VITE_PUBLIC_FORCE_GAME_MODE_ID;

const resolveGameModeConfig = (): GameModeConfig => {
  if (FORCED_GAME_MODE_ID) {
    return GAME_MODE_BY_ID[FORCED_GAME_MODE_ID];
  }

  for (const mode of GAME_MODE_ORDER) {
    if (mode.matches()) {
      return mode;
    }
  }
  return eternumConfig;
};

export const getGameModeConfig = (): GameModeConfig => resolveGameModeConfig();

export const getGameModeId = (): GameModeId => getGameModeConfig().id;

const getGameModeConfigById = (id: GameModeId): GameModeConfig => GAME_MODE_BY_ID[id];
