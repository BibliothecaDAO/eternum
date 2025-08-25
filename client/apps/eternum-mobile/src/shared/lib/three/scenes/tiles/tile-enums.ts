import { BiomeType, BuildingType, TroopTier, TroopType } from "@bibliothecadao/types";

export enum BiomeTileIndex {
  Outline = 0,
  Beach = 1,
  TemperateDeciduousForest = 2,
  Grassland = 3,
  Ocean = 4,
  Shrubland = 5,
  Snow = 6,
  Taiga = 7,
  TemperateDesert = 8,
  TropicalRainForest = 9,
  TropicalSeasonalForest = 10,
  Tundra = 11,
  Bare = 12,
  DeepOcean = 13,
  Scorched = 14,
  SubtropicalDesert = 15,
  TemperateRainForest = 16,
  None = 17,
}

export const BiomeTypeToTileIndex: Record<BiomeType, BiomeTileIndex> = {
  [BiomeType.None]: BiomeTileIndex.None,
  [BiomeType.Beach]: BiomeTileIndex.Beach,
  [BiomeType.TemperateDeciduousForest]: BiomeTileIndex.TemperateDeciduousForest,
  [BiomeType.Grassland]: BiomeTileIndex.Grassland,
  [BiomeType.Ocean]: BiomeTileIndex.Ocean,
  [BiomeType.Shrubland]: BiomeTileIndex.Shrubland,
  [BiomeType.Snow]: BiomeTileIndex.Snow,
  [BiomeType.Taiga]: BiomeTileIndex.Taiga,
  [BiomeType.TemperateDesert]: BiomeTileIndex.TemperateDesert,
  [BiomeType.TemperateRainForest]: BiomeTileIndex.TemperateRainForest,
  [BiomeType.TropicalSeasonalForest]: BiomeTileIndex.TropicalSeasonalForest,
  [BiomeType.TropicalRainForest]: BiomeTileIndex.TropicalRainForest,
  [BiomeType.SubtropicalDesert]: BiomeTileIndex.SubtropicalDesert,
  [BiomeType.Tundra]: BiomeTileIndex.Tundra,
  [BiomeType.Bare]: BiomeTileIndex.Bare,
  [BiomeType.DeepOcean]: BiomeTileIndex.DeepOcean,
  [BiomeType.Scorched]: BiomeTileIndex.Scorched,
};

export enum BuildingTileIndex {
  None = 0,
  WorkersHut = 1,
  Storehouse = 2,
  Farm = 3,
  FishingVillage = 4,
  Mine = 5,
  LumberMill = 6,
  Forge = 7,
  Barracks = 8,
  Archery = 9,
  Stable = 10,
  Market = 11,
  Bank = 12,
  FragmentMine = 13,
  Dragonhide = 14,
  Wonder = 15,
  Hyperstructure = 16,
  Village = 17,
}

export const BuildingTypeToTileIndex: Record<BuildingType, BuildingTileIndex> = {
  [BuildingType.None]: BuildingTileIndex.None,
  [BuildingType.WorkersHut]: BuildingTileIndex.WorkersHut,
  [BuildingType.Storehouse]: BuildingTileIndex.Storehouse,
  [BuildingType.ResourceStone]: BuildingTileIndex.Mine,
  [BuildingType.ResourceCoal]: BuildingTileIndex.Mine,
  [BuildingType.ResourceWood]: BuildingTileIndex.LumberMill,
  [BuildingType.ResourceCopper]: BuildingTileIndex.Mine,
  [BuildingType.ResourceIronwood]: BuildingTileIndex.LumberMill,
  [BuildingType.ResourceObsidian]: BuildingTileIndex.Mine,
  [BuildingType.ResourceGold]: BuildingTileIndex.Mine,
  [BuildingType.ResourceSilver]: BuildingTileIndex.Mine,
  [BuildingType.ResourceMithral]: BuildingTileIndex.Mine,
  [BuildingType.ResourceAlchemicalSilver]: BuildingTileIndex.Mine,
  [BuildingType.ResourceColdIron]: BuildingTileIndex.Mine,
  [BuildingType.ResourceDeepCrystal]: BuildingTileIndex.Mine,
  [BuildingType.ResourceRuby]: BuildingTileIndex.Mine,
  [BuildingType.ResourceDiamonds]: BuildingTileIndex.Mine,
  [BuildingType.ResourceHartwood]: BuildingTileIndex.LumberMill,
  [BuildingType.ResourceIgnium]: BuildingTileIndex.Mine,
  [BuildingType.ResourceTwilightQuartz]: BuildingTileIndex.Mine,
  [BuildingType.ResourceTrueIce]: BuildingTileIndex.Mine,
  [BuildingType.ResourceAdamantine]: BuildingTileIndex.Mine,
  [BuildingType.ResourceSapphire]: BuildingTileIndex.Mine,
  [BuildingType.ResourceEtherealSilica]: BuildingTileIndex.Mine,
  [BuildingType.ResourceDragonhide]: BuildingTileIndex.Dragonhide,
  [BuildingType.ResourceLabor]: BuildingTileIndex.WorkersHut,
  [BuildingType.ResourceAncientFragment]: BuildingTileIndex.FragmentMine,
  [BuildingType.ResourceDonkey]: BuildingTileIndex.Market,
  [BuildingType.ResourceKnightT1]: BuildingTileIndex.Barracks,
  [BuildingType.ResourceKnightT2]: BuildingTileIndex.Barracks,
  [BuildingType.ResourceKnightT3]: BuildingTileIndex.Barracks,
  [BuildingType.ResourceCrossbowmanT1]: BuildingTileIndex.Archery,
  [BuildingType.ResourceCrossbowmanT2]: BuildingTileIndex.Archery,
  [BuildingType.ResourceCrossbowmanT3]: BuildingTileIndex.Archery,
  [BuildingType.ResourcePaladinT1]: BuildingTileIndex.Stable,
  [BuildingType.ResourcePaladinT2]: BuildingTileIndex.Stable,
  [BuildingType.ResourcePaladinT3]: BuildingTileIndex.Stable,
  [BuildingType.ResourceWheat]: BuildingTileIndex.Farm,
  [BuildingType.ResourceFish]: BuildingTileIndex.FishingVillage,
  [BuildingType.ResourceEssence]: BuildingTileIndex.Mine,
};

export enum UnitTileIndex {
  None = 0,
  KnightT1 = 1,
  KnightT2 = 2,
  KnightT3 = 3,
  CrossbowmanT1 = 4,
  CrossbowmanT2 = 5,
  CrossbowmanT3 = 6,
  PaladinT1 = 7,
  PaladinT2 = 8,
  PaladinT3 = 9,
  Donkey = 10,
}

export function getTroopTileIndex(troopType: TroopType, troopTier: TroopTier): UnitTileIndex {
  switch (troopType) {
    case TroopType.Knight:
      switch (troopTier) {
        case TroopTier.T1:
          return UnitTileIndex.KnightT1;
        case TroopTier.T2:
          return UnitTileIndex.KnightT2;
        case TroopTier.T3:
          return UnitTileIndex.KnightT3;
      }
    case TroopType.Crossbowman:
      switch (troopTier) {
        case TroopTier.T1:
          return UnitTileIndex.CrossbowmanT1;
        case TroopTier.T2:
          return UnitTileIndex.CrossbowmanT2;
        case TroopTier.T3:
          return UnitTileIndex.CrossbowmanT3;
      }
    case TroopType.Paladin:
      switch (troopTier) {
        case TroopTier.T1:
          return UnitTileIndex.PaladinT1;
        case TroopTier.T2:
          return UnitTileIndex.PaladinT2;
        case TroopTier.T3:
          return UnitTileIndex.PaladinT3;
      }
  }
}

export interface TilemapConfig {
  path: string;
  tileWidth: number;
  tileHeight: number;
  tileGap: number;
}

export const TILEMAP_CONFIGS = {
  biomes: {
    path: "/images/tiles/biomes.png",
    tileWidth: 256,
    tileHeight: 312,
    tileGap: 1,
  },
  buildings: {
    path: "/images/tiles/buildings.png",
    tileWidth: 256,
    tileHeight: 576,
    tileGap: 1,
  },
  units: {
    path: "/images/tiles/units.png",
    tileWidth: 256,
    tileHeight: 312,
    tileGap: 1,
  },
} as const satisfies Record<string, TilemapConfig>;
