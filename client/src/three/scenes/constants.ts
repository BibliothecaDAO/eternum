import { ResourceMiningTypes } from "@/types";
import { BuildingType, StructureType } from "@bibliothecadao/eternum";
import { BiomeType } from "../components/Biome";

export const HEX_SIZE = 1;
export const BUILDINGS_CENTER = [10, 10];

export const PREVIEW_BUILD_COLOR_VALID = 0x00a300;
export const PREVIEW_BUILD_COLOR_INVALID = 0xff0000;

export const structureTypeToBuildingType: Record<StructureType, BuildingType> = {
  [StructureType.Bank]: BuildingType.Bank,
  [StructureType.Realm]: BuildingType.Castle,
  [StructureType.FragmentMine]: BuildingType.FragmentMine,
  [StructureType.Settlement]: BuildingType.Castle,
  [StructureType.Hyperstructure]: BuildingType.Castle,
};

export const buildingModelPaths: Record<BuildingType | ResourceMiningTypes, string> = {
  // placeholder for now
  [BuildingType.None]: "/models/buildings/farm.glb",
  [BuildingType.Bank]: "/models/buildings/market.glb",
  [BuildingType.ArcheryRange]: "/models/buildings/archer_range.glb",
  [BuildingType.Barracks]: "/models/buildings/barracks.glb",
  [BuildingType.Castle]: "/models/buildings/castle2.glb",
  [BuildingType.Farm]: "/models/buildings/farm.glb",
  [BuildingType.FishingVillage]: "/models/buildings/fishery.glb",
  [BuildingType.FragmentMine]: "/models/buildings/mine.glb",
  [BuildingType.Market]: "/models/buildings/market.glb",
  [BuildingType.Resource]: "/models/buildings/mine.glb",
  [BuildingType.Stable]: "/models/buildings/stable.glb",
  [BuildingType.Storehouse]: "/models/buildings/storehouse.glb",
  [BuildingType.TradingPost]: "/models/buildings/market.glb",
  [BuildingType.Walls]: "/models/buildings/market.glb",
  [BuildingType.WatchTower]: "/models/buildings/market.glb",
  [BuildingType.WorkersHut]: "/models/buildings/workers_hut.glb",
  [ResourceMiningTypes.Forge]: "/models/buildings/forge.glb",
  [ResourceMiningTypes.Mine]: "/models/buildings/mine.glb",
  [ResourceMiningTypes.LumberMill]: "/models/buildings/lumber_mill.glb",
  [ResourceMiningTypes.Dragonhide]: "/models/buildings/dragonhide.glb",
};

const BASE_PATH = "/models/bevel-biomes/";
export const biomeModelPaths: Record<BiomeType | "Outline", string> = {
  DeepOcean: BASE_PATH + "deepocean.glb",
  Ocean: BASE_PATH + "ocean.glb",
  Beach: BASE_PATH + "beach.glb",
  Scorched: BASE_PATH + "scorched.glb",
  Bare: BASE_PATH + "bare.glb",
  Tundra: BASE_PATH + "tundra.glb",
  Snow: BASE_PATH + "snow.glb",
  TemperateDesert: BASE_PATH + "temperatedessert.glb",
  Shrubland: BASE_PATH + "shrublands.glb",
  Taiga: BASE_PATH + "taiga.glb",
  Grassland: BASE_PATH + "grassland.glb",
  TemperateDeciduousForest: BASE_PATH + "deciduousforest.glb",
  TemperateRainForest: BASE_PATH + "temperateRainforest.glb",
  SubtropicalDesert: BASE_PATH + "subtropicaldesert.glb",
  TropicalSeasonalForest: BASE_PATH + "tropicalrainforest.glb",
  TropicalRainForest: BASE_PATH + "tropicalrainforest.glb",
  Outline: BASE_PATH + "outline.glb",
};

export const PROGRESS_HALF_THRESHOLD = 0.5;
export const PROGRESS_FINAL_THRESHOLD = 1;

export enum StructureProgress {
  STAGE_1 = 0,
  STAGE_2 = 1,
  STAGE_3 = 2,
}

export const StructureModelPaths: Record<StructureType, string[]> = {
  [StructureType.Realm]: ["models/buildings/castle2.glb"],
  // Order follows StructureProgress
  [StructureType.Hyperstructure]: [
    "models/buildings/hyperstructure_init.glb",
    "models/buildings/hyperstructure_half.glb",
    "models/buildings/hyperstructure_final.glb",
  ],
  [StructureType.Bank]: ["/models/buildings/market.glb"],
  [StructureType.FragmentMine]: ["models/buildings/mine.glb"],
  // placeholder for now
  [StructureType.Settlement]: ["models/buildings/mine.glb"],
};

export const StructureLabelPaths: Record<StructureType, string> = {
  [StructureType.Realm]: "textures/realm_label.png",
  [StructureType.Hyperstructure]: "textures/hyper_label.png",
  [StructureType.FragmentMine]: "textures/shard_label.png",
  // placeholder for now
  [StructureType.Bank]: "",
  // placeholder for now
  [StructureType.Settlement]: "textures/shard_label.png",
};
