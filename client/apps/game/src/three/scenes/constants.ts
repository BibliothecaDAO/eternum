import { HyperstructureTypesNames, ResourceMiningTypes } from "@/types";
import { BuildingType, RealmLevelNames, RealmLevels, ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { BiomeType } from "../components/Biome";

export const HEX_SIZE = 1;
export const BUILDINGS_CENTER = [10, 10];

export const PREVIEW_BUILD_COLOR_VALID = 0x00a300;
export const PREVIEW_BUILD_COLOR_INVALID = 0xff0000;

export const DUMMY_HYPERSTRUCTURE_ENTITY_ID = 99999999n;

export const structureTypeToBuildingType: Record<StructureType, BuildingType> = {
  [StructureType.Bank]: BuildingType.Bank,
  [StructureType.Realm]: BuildingType.Castle,
  [StructureType.FragmentMine]: BuildingType.FragmentMine,
  [StructureType.Settlement]: BuildingType.Castle,
  [StructureType.Hyperstructure]: BuildingType.Castle,
};

export const castleLevelToRealmCastle: Record<RealmLevels, RealmLevelNames> = {
  [RealmLevels.Settlement]: RealmLevelNames.Settlement,
  [RealmLevels.City]: RealmLevelNames.City,
  [RealmLevels.Kingdom]: RealmLevelNames.Kingdom,
  [RealmLevels.Empire]: RealmLevelNames.Empire,
};

export enum StructureProgress {
  STAGE_1 = 0,
  STAGE_2 = 1,
  STAGE_3 = 2,
}

export const hyperstructureStageToModel: Record<StructureProgress, string> = {
  [StructureProgress.STAGE_1]: HyperstructureTypesNames.STAGE_1,
  [StructureProgress.STAGE_2]: HyperstructureTypesNames.STAGE_2,
  [StructureProgress.STAGE_3]: HyperstructureTypesNames.STAGE_3,
};

export const WONDER_REALM = "Wonder";

export const buildingModelPaths: Record<
  BuildingType | ResourceMiningTypes | RealmLevelNames | HyperstructureTypesNames | typeof WONDER_REALM,
  string
> = {
  // placeholder for now
  [BuildingType.None]: "/models/buildings-opt/farm.glb",
  [BuildingType.Bank]: "/models/buildings-opt/bank.glb",
  [BuildingType.ArcheryRange]: "/models/buildings-opt/archerrange.glb",
  [BuildingType.Barracks]: "/models/buildings-opt/barracks.glb",
  [BuildingType.Castle]: "/models/buildings-opt/castle1.glb",
  [BuildingType.Farm]: "/models/buildings-opt/farm.glb",
  [BuildingType.FishingVillage]: "/models/buildings-opt/fishery.glb",
  [BuildingType.FragmentMine]: "/models/buildings-opt/mine.glb",
  [BuildingType.Market]: "/models/buildings-opt/market.glb",
  [BuildingType.Resource]: "/models/buildings-opt/mine.glb",
  [BuildingType.Stable]: "/models/buildings-opt/stable.glb",
  [BuildingType.Storehouse]: "/models/buildings-opt/storehouse.glb",
  [BuildingType.TradingPost]: "/models/buildings-opt/market.glb",
  [BuildingType.Walls]: "/models/buildings-opt/market.glb",
  [BuildingType.WatchTower]: "/models/buildings-opt/market.glb",
  [BuildingType.WorkersHut]: "/models/buildings-opt/workers_hut.glb",
  [ResourceMiningTypes.Forge]: "/models/buildings-opt/forge.glb",
  [ResourceMiningTypes.Mine]: "/models/buildings-opt/mine.glb",
  [ResourceMiningTypes.LumberMill]: "/models/buildings-opt/lumber_mill.glb",
  [ResourceMiningTypes.Dragonhide]: "/models/buildings-opt/dragonhide.glb",
  [RealmLevelNames.Settlement]: "/models/buildings-opt/castle0.glb",
  [RealmLevelNames.City]: "/models/buildings-opt/castle1.glb",
  [RealmLevelNames.Kingdom]: "/models/buildings-opt/castle2.glb",
  [RealmLevelNames.Empire]: "/models/buildings-opt/castle3.glb",
  [HyperstructureTypesNames.STAGE_1]: "/models/buildings-opt/hyperstructure_init.glb",
  [HyperstructureTypesNames.STAGE_2]: "/models/buildings-opt/hyperstructure_half.glb",
  [HyperstructureTypesNames.STAGE_3]: "/models/buildings-opt/hyperstructure.glb",
  [WONDER_REALM]: "/models/buildings-opt/wonder.glb",
};

const BASE_PATH = "/models/biomes-opt/";
export const biomeModelPaths: Record<BiomeType | "Outline", string> = {
  Bare: BASE_PATH + "bare.glb",
  Beach: BASE_PATH + "beach.glb",
  TemperateDeciduousForest: BASE_PATH + "deciduousForest.glb",
  DeepOcean: BASE_PATH + "deepOcean.glb",
  Grassland: BASE_PATH + "grassland.glb",
  Ocean: BASE_PATH + "ocean.glb",
  Outline: BASE_PATH + "outline.glb",
  Scorched: BASE_PATH + "scorched.glb",
  Tundra: BASE_PATH + "tundra.glb",
  TemperateDesert: BASE_PATH + "temperateDesert.glb",
  Shrubland: BASE_PATH + "shrubland.glb",
  Snow: BASE_PATH + "snow.glb",
  Taiga: BASE_PATH + "taiga.glb",
  TemperateRainForest: BASE_PATH + "temperateRainforest.glb",
  SubtropicalDesert: BASE_PATH + "subtropicalDesert.glb",
  TropicalRainForest: BASE_PATH + "tropicalRainforest.glb",
  TropicalSeasonalForest: BASE_PATH + "tropicalSeasonalForest.glb",
};

export const PROGRESS_HALF_THRESHOLD = 50;
export const PROGRESS_FINAL_THRESHOLD = 100;

export const StructureModelPaths: Record<StructureType, string[]> = {
  [StructureType.Realm]: [
    "models/buildings-opt/castle0.glb",
    "models/buildings-opt/castle1.glb",
    "models/buildings-opt/castle2.glb",
    "models/buildings-opt/castle3.glb",
    "models/buildings-opt/wonder2.glb",
  ],
  // Order follows StructureProgress
  [StructureType.Hyperstructure]: [
    "models/buildings-opt/hyperstructure_init.glb",
    "models/buildings-opt/hyperstructure_half.glb",
    "models/buildings-opt/hyperstructure.glb",
  ],
  [StructureType.Bank]: ["/models/buildings-opt/bank.glb"],
  [StructureType.FragmentMine]: ["models/buildings-opt/mine.glb"],
  // placeholder for now
  [StructureType.Settlement]: ["models/buildings-opt/castle2.glb"],
};

export const StructureLabelPaths: Record<StructureType, string> = {
  [StructureType.Realm]: "textures/realm_label.png",
  [StructureType.Hyperstructure]: "textures/hyper_label.png",
  [StructureType.FragmentMine]: "textures/fragment_mine_label.png",
  // placeholder for now
  [StructureType.Bank]: "",
  // placeholder for now
  [StructureType.Settlement]: "textures/fragment_mine_label.png",
};

export const MinesMaterialsParams: Record<
  number,
  { color: THREE.Color; emissive: THREE.Color; emissiveIntensity: number }
> = {
  // [ResourcesIds.Copper]: ResourceMiningTypes.Forge,
  // [ResourcesIds.ColdIron]: ResourceMiningTypes.Forge,
  // [ResourcesIds.Ignium]: ResourceMiningTypes.Forge,
  // [ResourcesIds.Gold]: ResourceMiningTypes.Forge,
  // [ResourcesIds.Silver]: ResourceMiningTypes.Forge,
  // [ResourcesIds.AlchemicalSilver]: ResourceMiningTypes.Forge,
  // [ResourcesIds.Adamantine]: ResourceMiningTypes.Forge,
  [ResourcesIds.Copper]: {
    color: new THREE.Color(0.86, 0.26, 0.0),
    emissive: new THREE.Color(6.71, 0.25, 0.08),
    emissiveIntensity: 5.9,
  },
  [ResourcesIds.ColdIron]: {
    color: new THREE.Color(0.69, 0.63, 0.99),
    emissive: new THREE.Color(0.76, 1.63, 6.82),
    emissiveIntensity: 5.9,
  },
  [ResourcesIds.Ignium]: {
    color: new THREE.Color(0.97, 0.03, 0.03),
    emissive: new THREE.Color(6.31, 0.13, 0.04),
    emissiveIntensity: 8.6,
  },
  [ResourcesIds.Gold]: {
    color: new THREE.Color(0.99, 0.83, 0.3),
    emissive: new THREE.Color(9.88, 6.79, 3.02),
    emissiveIntensity: 4.9,
  },
  [ResourcesIds.Silver]: {
    color: new THREE.Color(0.93, 0.93, 0.93),
    emissive: new THREE.Color(3.55, 3.73, 5.51),
    emissiveIntensity: 8.6,
  },
  [ResourcesIds.AlchemicalSilver]: {
    color: new THREE.Color(0.93, 0.93, 0.93),
    emissive: new THREE.Color(1.87, 4.57, 9.33),
    emissiveIntensity: 8.4,
  },
  [ResourcesIds.Adamantine]: {
    color: new THREE.Color(0.0, 0.27, 1.0),
    emissive: new THREE.Color(1.39, 0.52, 8.16),
    emissiveIntensity: 10,
  },
  [ResourcesIds.Diamonds]: {
    color: new THREE.Color(1.6, 1.47, 1.96),
    emissive: new THREE.Color(0.8, 0.73, 5.93),
    emissiveIntensity: 0.2,
  },
  [ResourcesIds.Sapphire]: {
    color: new THREE.Color(0.23, 0.5, 0.96),
    emissive: new THREE.Color(0, 0, 5.01),
    emissiveIntensity: 2.5,
  },
  [ResourcesIds.Ruby]: {
    color: new THREE.Color(0.86, 0.15, 0.15),
    emissive: new THREE.Color(2.59, 0.0, 0.0),
    emissiveIntensity: 4,
  },
  [ResourcesIds.DeepCrystal]: {
    color: new THREE.Color(1.21, 2.7, 3.27),
    emissive: new THREE.Color(0.58, 0.77, 3),
    emissiveIntensity: 5,
  },
  [ResourcesIds.TwilightQuartz]: {
    color: new THREE.Color(0.43, 0.16, 0.85),
    emissive: new THREE.Color(0.0, 0.03, 4.25),
    emissiveIntensity: 5.7,
  },
  [ResourcesIds.EtherealSilica]: {
    color: new THREE.Color(0.06, 0.73, 0.51),
    emissive: new THREE.Color(0.0, 0.12, 0.0),
    emissiveIntensity: 2,
  },
  [ResourcesIds.Stone]: {
    color: new THREE.Color(0.38, 0.38, 0.38),
    emissive: new THREE.Color(0, 0, 0),
    emissiveIntensity: 0,
  },
  [ResourcesIds.Coal]: {
    color: new THREE.Color(0.18, 0.18, 0.18),
    emissive: new THREE.Color(0, 0, 0),
    emissiveIntensity: 0,
  },
  [ResourcesIds.Obsidian]: {
    color: new THREE.Color(0.06, 0.06, 0.06),
    emissive: new THREE.Color(0, 0, 0),
    emissiveIntensity: 1,
  },
  [ResourcesIds.TrueIce]: {
    color: new THREE.Color(3.0, 3.0, 3.8),
    emissive: new THREE.Color(1.0, 1.0, 1),
    emissiveIntensity: 4,
  },
  [ResourcesIds.AncientFragment]: {
    color: new THREE.Color(0.43, 0.85, 0.16),
    emissive: new THREE.Color(0.0, 3.25, 0.03),
    emissiveIntensity: 5.7,
  },
};
