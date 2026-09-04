import { StructureProgress } from "@bibliothecadao/eternum";
import {
  BuildingType,
  RealmLevelNames,
  RealmLevels,
  ResourceMiningTypes,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import { Color } from "three";
import { HyperstructureTypesNames } from "../types";

export const HEX_SIZE = 1;

export const PREVIEW_BUILD_COLOR_VALID = 0x00a300;
export const PREVIEW_BUILD_COLOR_INVALID = 0xff0000;

const BUILDINGS_MODELS_PATH = "/models/new-buildings-opt/";

const buildUniqueAssetPaths = (assetPaths: readonly string[]) => Object.freeze(Array.from(new Set(assetPaths)));

enum BuildingFilenames {
  Bank = "bank.glb",
  ArcheryRange = "archerrange.glb",
  Barracks = "barracks.glb",
  Castle = "castle1.glb",
  Farm = "farm.glb",
  FishingVillage = "fishery.glb",
  FragmentMine = "mine.glb",
  Camp = "camp.glb",
  EssenceRift = "essence_rift.glb",
  Market = "market.glb",
  Resource = "mine.glb",
  Stable = "stable.glb",
  Storehouse = "storehouse.glb",
  WorkersHut = "workers_hut.glb",
  Forge = "forge.glb",
  Mine = "mine.glb",
  LumberMill = "lumber_mill.glb",
  Dragonhide = "dragonhide.glb",
  Wonder = "wonder2.glb",
  HyperstructureInit = "hyperstructure_init.glb",
  HyperstructureHalf = "hyperstructure_half.glb",
  Hyperstructure = "hyperstructure_finish.glb",
  Realm0 = "castle0.glb",
  Realm1 = "castle1.glb",
  Realm2 = "castle2.glb",
  Realm3 = "castle3.glb",
  Village = "village.glb",
  WonderAnimated = "wonder2.glb",
}

enum ChestFilenames {
  Chest = "chest_model.glb",
}

export const ChestModelPath = "/models/new-buildings-opt/" + ChestFilenames.Chest;
export const ReservedHyperstructureModelPath = "/models/new-buildings-opt/" + BuildingFilenames.HyperstructureInit;

export const SHARED_BUILDING_MODEL_PATHS = buildUniqueAssetPaths(
  Object.values(BuildingFilenames).map((fileName) => `${BUILDINGS_MODELS_PATH}${fileName}`),
);

export const SHARED_CHEST_MODEL_PATHS = buildUniqueAssetPaths([ChestModelPath]);

export const structureTypeToBuildingType: Record<StructureType, BuildingType> = {
  [StructureType.Bank]: BuildingType.ResourceDonkey,
  [StructureType.Realm]: BuildingType.ResourceLabor,
  [StructureType.FragmentMine]: BuildingType.ResourceAncientFragment,
  [StructureType.Hyperstructure]: BuildingType.ResourceLabor,
  [StructureType.Village]: BuildingType.ResourceLabor,
  [StructureType.HolySite]: BuildingType.ResourceLabor,
  [StructureType.Camp]: BuildingType.ResourceLabor,
  [StructureType.BitcoinMine]: BuildingType.ResourceLabor,
};

export const castleLevelToRealmCastle: Record<RealmLevels, RealmLevelNames> = {
  [RealmLevels.Settlement]: RealmLevelNames.Settlement,
  [RealmLevels.City]: RealmLevelNames.City,
  [RealmLevels.Kingdom]: RealmLevelNames.Kingdom,
  [RealmLevels.Empire]: RealmLevelNames.Empire,
};

export const hyperstructureStageToModel: Record<StructureProgress, HyperstructureTypesNames> = {
  [StructureProgress.STAGE_1]: HyperstructureTypesNames.STAGE_1,
  [StructureProgress.STAGE_2]: HyperstructureTypesNames.STAGE_2,
  [StructureProgress.STAGE_3]: HyperstructureTypesNames.STAGE_3,
};

export const WONDER_REALM = "Wonder";

export enum BUILDINGS_GROUPS {
  BUILDINGS = "buildings",
  RESOURCES_MINING = "resources_mining",
  HYPERSTRUCTURE = "hyperstructure",
  REALMS = "realms",
  WONDER = "wonder",
  VILLAGE = "village",
}

export type BUILDINGS_CATEGORIES_TYPES =
  | BuildingType
  | ResourceMiningTypes
  | RealmLevelNames
  | HyperstructureTypesNames
  | typeof WONDER_REALM
  | StructureType.Village
  | StructureType.Camp;

export const buildingModelPaths = (isBlitz: boolean) => {
  return {
    [BUILDINGS_GROUPS.BUILDINGS]: {
      [BuildingType.None]: BUILDINGS_MODELS_PATH + BuildingFilenames.Farm,
      [BuildingType.ResourceCrossbowmanT1]: BUILDINGS_MODELS_PATH + BuildingFilenames.ArcheryRange,
      [BuildingType.ResourceCrossbowmanT2]: BUILDINGS_MODELS_PATH + BuildingFilenames.ArcheryRange,
      [BuildingType.ResourceCrossbowmanT3]: BUILDINGS_MODELS_PATH + BuildingFilenames.ArcheryRange,
      [BuildingType.ResourceKnightT1]: BUILDINGS_MODELS_PATH + BuildingFilenames.Barracks,
      [BuildingType.ResourceKnightT2]: BUILDINGS_MODELS_PATH + BuildingFilenames.Barracks,
      [BuildingType.ResourceKnightT3]: BUILDINGS_MODELS_PATH + BuildingFilenames.Barracks,
      [BuildingType.ResourcePaladinT1]: BUILDINGS_MODELS_PATH + BuildingFilenames.Stable,
      [BuildingType.ResourcePaladinT2]: BUILDINGS_MODELS_PATH + BuildingFilenames.Stable,
      [BuildingType.ResourcePaladinT3]: BUILDINGS_MODELS_PATH + BuildingFilenames.Stable,
      [BuildingType.ResourceLabor]: BUILDINGS_MODELS_PATH + BuildingFilenames.Castle,
      [BuildingType.ResourceWheat]: BUILDINGS_MODELS_PATH + BuildingFilenames.Farm,
      [BuildingType.ResourceFish]: BUILDINGS_MODELS_PATH + BuildingFilenames.FishingVillage,
      [BuildingType.ResourceAncientFragment]: isBlitz
        ? BUILDINGS_MODELS_PATH + BuildingFilenames.EssenceRift
        : BUILDINGS_MODELS_PATH + BuildingFilenames.FragmentMine,
      [BuildingType.ResourceEssence]: BUILDINGS_MODELS_PATH + BuildingFilenames.EssenceRift,
      [BuildingType.ResourceDonkey]: BUILDINGS_MODELS_PATH + BuildingFilenames.Market,
      [BuildingType.Storehouse]: BUILDINGS_MODELS_PATH + BuildingFilenames.Storehouse,
      [BuildingType.WorkersHut]: BUILDINGS_MODELS_PATH + BuildingFilenames.WorkersHut,
      [BuildingType.ResourceDragonhide]: BUILDINGS_MODELS_PATH + BuildingFilenames.Dragonhide,
      [BuildingType.ResourceResearch]: BUILDINGS_MODELS_PATH + BuildingFilenames.Castle,
    },
    [BUILDINGS_GROUPS.RESOURCES_MINING]: {
      [ResourceMiningTypes.Forge]: BUILDINGS_MODELS_PATH + BuildingFilenames.Forge,
      [ResourceMiningTypes.Mine]: BUILDINGS_MODELS_PATH + BuildingFilenames.Mine,
      [ResourceMiningTypes.LumberMill]: BUILDINGS_MODELS_PATH + BuildingFilenames.LumberMill,
      [ResourceMiningTypes.Dragonhide]: BUILDINGS_MODELS_PATH + BuildingFilenames.Dragonhide,
    },
    [BUILDINGS_GROUPS.REALMS]: {
      [RealmLevelNames.Settlement]: BUILDINGS_MODELS_PATH + BuildingFilenames.Realm0,
      [RealmLevelNames.City]: BUILDINGS_MODELS_PATH + BuildingFilenames.Realm1,
      [RealmLevelNames.Kingdom]: BUILDINGS_MODELS_PATH + BuildingFilenames.Realm2,
      [RealmLevelNames.Empire]: BUILDINGS_MODELS_PATH + BuildingFilenames.Realm3,
    },
    [BUILDINGS_GROUPS.VILLAGE]: {
      [StructureType.Village]: isBlitz
        ? BUILDINGS_MODELS_PATH + BuildingFilenames.Camp
        : BUILDINGS_MODELS_PATH + BuildingFilenames.Village,
      [StructureType.Camp]: BUILDINGS_MODELS_PATH + BuildingFilenames.Camp,
    },
    [BUILDINGS_GROUPS.HYPERSTRUCTURE]: {
      [HyperstructureTypesNames.STAGE_1]: BUILDINGS_MODELS_PATH + BuildingFilenames.HyperstructureInit,
      [HyperstructureTypesNames.STAGE_2]: BUILDINGS_MODELS_PATH + BuildingFilenames.HyperstructureHalf,
      [HyperstructureTypesNames.STAGE_3]: BUILDINGS_MODELS_PATH + BuildingFilenames.Hyperstructure,
    },
    [BUILDINGS_GROUPS.WONDER]: {
      [WONDER_REALM]: BUILDINGS_MODELS_PATH + BuildingFilenames.Wonder,
    },
  };
};

const PROGRESS_HALF_THRESHOLD = 50;
const PROGRESS_FINAL_THRESHOLD = 100;

export function getStructureModelPaths(isBlitz: boolean): Record<StructureType, string[]> {
  return {
    [StructureType.Realm]: [
      BUILDINGS_MODELS_PATH + BuildingFilenames.Realm0,
      BUILDINGS_MODELS_PATH + BuildingFilenames.Realm1,
      BUILDINGS_MODELS_PATH + BuildingFilenames.Realm2,
      BUILDINGS_MODELS_PATH + BuildingFilenames.Realm3,
      BUILDINGS_MODELS_PATH + BuildingFilenames.WonderAnimated,
    ],
    [StructureType.Hyperstructure]: [
      BUILDINGS_MODELS_PATH + BuildingFilenames.HyperstructureInit,
      BUILDINGS_MODELS_PATH + BuildingFilenames.HyperstructureHalf,
      BUILDINGS_MODELS_PATH + BuildingFilenames.Hyperstructure,
    ],
    [StructureType.Bank]: [BUILDINGS_MODELS_PATH + BuildingFilenames.Bank],
    [StructureType.FragmentMine]: isBlitz
      ? [BUILDINGS_MODELS_PATH + BuildingFilenames.EssenceRift]
      : [BUILDINGS_MODELS_PATH + BuildingFilenames.Mine],
    [StructureType.Village]: isBlitz
      ? [BUILDINGS_MODELS_PATH + BuildingFilenames.Camp]
      : [BUILDINGS_MODELS_PATH + BuildingFilenames.Village],
    [StructureType.HolySite]: [BUILDINGS_MODELS_PATH + BuildingFilenames.Castle],
    [StructureType.Camp]: [BUILDINGS_MODELS_PATH + BuildingFilenames.Camp],
    [StructureType.BitcoinMine]: [BUILDINGS_MODELS_PATH + BuildingFilenames.Mine],
  };
}

export const MinesMaterialsParams: Record<number, { color: Color; emissive: Color; emissiveIntensity: number }> = {
  [ResourcesIds.Copper]: {
    color: new Color(0.86, 0.26, 0.0),
    emissive: new Color(6.71, 0.25, 0.08),
    emissiveIntensity: 5.9,
  },
  [ResourcesIds.ColdIron]: {
    color: new Color(0.69, 0.63, 0.99),
    emissive: new Color(0.76, 1.63, 6.82),
    emissiveIntensity: 5.9,
  },
  [ResourcesIds.Ignium]: {
    color: new Color(0.97, 0.03, 0.03),
    emissive: new Color(6.31, 0.13, 0.04),
    emissiveIntensity: 8.6,
  },
  [ResourcesIds.Gold]: {
    color: new Color(0.99, 0.83, 0.3),
    emissive: new Color(9.88, 6.79, 3.02),
    emissiveIntensity: 4.9,
  },
  [ResourcesIds.Silver]: {
    color: new Color(0.93, 0.93, 0.93),
    emissive: new Color(3.55, 3.73, 5.51),
    emissiveIntensity: 8.6,
  },
  [ResourcesIds.AlchemicalSilver]: {
    color: new Color(0.93, 0.93, 0.93),
    emissive: new Color(1.87, 4.57, 9.33),
    emissiveIntensity: 8.4,
  },
  [ResourcesIds.Adamantine]: {
    color: new Color(0.0, 0.27, 1.0),
    emissive: new Color(1.39, 0.52, 8.16),
    emissiveIntensity: 10,
  },
  [ResourcesIds.Diamonds]: {
    color: new Color(1.6, 1.47, 1.96),
    emissive: new Color(0.8, 0.73, 5.93),
    emissiveIntensity: 0.2,
  },
  [ResourcesIds.Sapphire]: {
    color: new Color(0.23, 0.5, 0.96),
    emissive: new Color(0, 0, 5.01),
    emissiveIntensity: 2.5,
  },
  [ResourcesIds.Ruby]: {
    color: new Color(0.86, 0.15, 0.15),
    emissive: new Color(2.59, 0.0, 0.0),
    emissiveIntensity: 4,
  },
  [ResourcesIds.DeepCrystal]: {
    color: new Color(1.21, 2.7, 3.27),
    emissive: new Color(0.58, 0.77, 3),
    emissiveIntensity: 5,
  },
  [ResourcesIds.TwilightQuartz]: {
    color: new Color(0.43, 0.16, 0.85),
    emissive: new Color(0.0, 0.03, 4.25),
    emissiveIntensity: 5.7,
  },
  [ResourcesIds.EtherealSilica]: {
    color: new Color(0.06, 0.73, 0.51),
    emissive: new Color(0.0, 0.12, 0.0),
    emissiveIntensity: 2,
  },
  [ResourcesIds.Stone]: {
    color: new Color(0.38, 0.38, 0.38),
    emissive: new Color(0, 0, 0),
    emissiveIntensity: 0,
  },
  [ResourcesIds.Coal]: {
    color: new Color(0.18, 0.18, 0.18),
    emissive: new Color(0, 0, 0),
    emissiveIntensity: 0,
  },
  [ResourcesIds.Obsidian]: {
    color: new Color(0.06, 0.06, 0.06),
    emissive: new Color(0, 0, 0),
    emissiveIntensity: 1,
  },
  [ResourcesIds.TrueIce]: {
    color: new Color(3.0, 3.0, 3.8),
    emissive: new Color(1.0, 1.0, 1),
    emissiveIntensity: 4,
  },
  [ResourcesIds.AncientFragment]: {
    color: new Color(0.25, 0.45, 0.15),
    emissive: new Color(0.0, 0.5, 0.03),
    emissiveIntensity: 0.8,
  },
};
