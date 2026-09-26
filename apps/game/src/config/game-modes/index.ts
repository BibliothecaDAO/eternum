import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  configManager,
  getEntityInfo,
  getStructureName,
  getStructureTypeName,
  nativeGameModeOf,
} from "@bibliothecadao/eternum";
import { BuildingType, type ContractAddress, type ID, StructureType, getResourceTiers } from "@bibliothecadao/types";
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
    showGuildsTab: boolean;
    showAutomation: boolean;
    /**
     * The build pickers beside a plot's own sheet: the scene's popover on an empty plot and the realm menu's
     * Construction entry. Frontier builds only from its build sheet on a tapped plot.
     */
    showBuildMenus: boolean;
    /** Shown on the army muster when the mode spends committed troops for good. */
    musterNotice: string | null;
    /** Where a player's session opens once through the doorway: the world map, or their realm's board. */
    entryScene: "map" | "hex";
  };
  resources: {
    getTiers: () => ReturnType<typeof getResourceTiers>;
  };
  rules: {
    isBuildingTypeAllowed: (key: string) => boolean;
    autoAllocateHyperstructureShares: boolean;
  };
  structure: {
    getName: (structure: StructureNameInput) => ReturnType<typeof getStructureName>;
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
  const paths = buildingModelPaths(isBlitz);
  const buildings: Partial<Record<BuildingType, string>> = { ...paths[BUILDINGS_GROUPS.BUILDINGS] };
  if (isBlitz) {
    for (const building of BLITZ_BUILDING_EXCLUSIONS) delete buildings[BuildingType[building]];
  }
  return { ...paths, [BUILDINGS_GROUPS.BUILDINGS]: buildings };
}

const buildStructureHelpers = (isBlitz: boolean) => ({
  getName: (structure: StructureNameInput) => getStructureName(structure, isBlitz),
  getTypeName: getStructureTypeName,
  getEntityInfo: (entityId: ID, playerAccount: ContractAddress | null, store: NativeFactStore) =>
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
    showGuildsTab: false,
    showAutomation: true,
    showBuildMenus: true,
    musterNotice: null,
    entryScene: "map",
  },
  resources: {
    getTiers: () => getResourceTiers(true),
  },
  rules: {
    isBuildingTypeAllowed: buildBuildingRule(BLITZ_BUILDING_EXCLUSIONS),
    autoAllocateHyperstructureShares: true,
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
    showGuildsTab: true,
    showAutomation: true,
    showBuildMenus: true,
    musterNotice: null,
    entryScene: "map",
  },
  resources: {
    getTiers: () => getResourceTiers(false),
  },
  rules: {
    isBuildingTypeAllowed: buildBuildingRule(new Set()),
    autoAllocateHyperstructureShares: false,
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
    showBuildMenus: false,
    musterNotice: "Committed troops do not return. What you send today is spent today, win or lose.",
    // A Frontier session opens on the realm, where the day's first build and deploy happen.
    entryScene: "hex",
  },
  resources: {
    getTiers: blitzConfig.resources.getTiers,
  },
  rules: {
    isBuildingTypeAllowed: (key) =>
      ["WorkersHut", "Storehouse", "ResourceWheat", "ResourceKnightT1", "ResourceLabor"].includes(key),
    autoAllocateHyperstructureShares: false,
  },
};
const duelConfig: GameModeConfig = {
  ...blitzConfig,
  id: "duel",
  displayName: "Duel",
  labels: { ...blitzConfig.labels, shareEventLabel: "Realms Duel", endgameCardTitle: "Realms Duel" },
};
const GAME_MODE_CONFIGS: Record<GameModeId, GameModeConfig> = {
  frontier: frontierConfig,
  blitz: blitzConfig,
  eternum: eternumConfig,
  duel: duelConfig,
};

/** A mode's config by its id, for surfaces that know the mode (the directory's row) before the game's config syncs. */
export const gameModeConfigOf = (id: GameModeId): GameModeConfig => GAME_MODE_CONFIGS[id];

export function getGameModeConfig(presetId = configManager.getPresetId()): GameModeConfig {
  return GAME_MODE_CONFIGS[nativeGameModeOf(presetId)];
}
export const getGameModeId = (): GameModeId => getGameModeConfig().id;
