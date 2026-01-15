import { BiomeType, BuildingType, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";

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
  Hyperstructure = 0,
  Chest = 1,
  EssenceRift = 2,
  Castle0 = 3,
  Castle1 = 4,
  Castle2 = 5,
  Castle3 = 6,
  ArcherRange = 7,
  Barracks = 8,
  Camp = 9,
  Farm = 10,
  FishingVillage = 11,
  Forge = 12,
  LumberMill = 13,
  Market = 14,
  Mine = 15,
  Stable = 16,
  Storehouse = 17,
  WorkersHut = 18,
}

export const structureTypeToBuildingTileIndex: Record<StructureType, BuildingTileIndex> = {
  [StructureType.Bank]: BuildingTileIndex.Market,
  [StructureType.Realm]: BuildingTileIndex.Castle0,
  [StructureType.FragmentMine]: BuildingTileIndex.EssenceRift,
  [StructureType.Hyperstructure]: BuildingTileIndex.Hyperstructure,
  [StructureType.Village]: BuildingTileIndex.Camp,
};

export const structureTypeToBuildingType: Record<StructureType, BuildingType> = {
  [StructureType.Bank]: BuildingType.ResourceDonkey,
  [StructureType.Realm]: BuildingType.ResourceLabor,
  [StructureType.FragmentMine]: BuildingType.ResourceAncientFragment,
  [StructureType.Hyperstructure]: BuildingType.ResourceLabor,
  [StructureType.Village]: BuildingType.ResourceLabor,
};

export function getStructureTileIndex(structureType: StructureType, level?: number): BuildingTileIndex {
  if (structureType === StructureType.Realm && level !== undefined) {
    switch (level) {
      case 1:
        return BuildingTileIndex.Castle1;
      case 2:
        return BuildingTileIndex.Castle2;
      case 3:
        return BuildingTileIndex.Castle3;
      default:
        return BuildingTileIndex.Castle0;
    }
  }

  const mappedTile = structureTypeToBuildingTileIndex[structureType];
  return mappedTile !== undefined ? mappedTile : BuildingTileIndex.Camp;
}

export function getBuildingTileIndex(
  structureType?: StructureType,
  buildingType?: BuildingType,
  level?: number,
): BuildingTileIndex {
  if (buildingType !== undefined) {
    const mappedTile = BuildingTypeToTileIndex[buildingType];
    return mappedTile !== undefined ? mappedTile : BuildingTileIndex.WorkersHut;
  }

  if (structureType !== undefined) {
    return getStructureTileIndex(structureType, level);
  }

  return BuildingTileIndex.WorkersHut;
}

export const BuildingTypeToTileIndex: Record<BuildingType, BuildingTileIndex> = {
  [BuildingType.None]: BuildingTileIndex.WorkersHut,
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
  [BuildingType.ResourceDragonhide]: BuildingTileIndex.Mine,
  [BuildingType.ResourceLabor]: BuildingTileIndex.WorkersHut,
  [BuildingType.ResourceAncientFragment]: BuildingTileIndex.EssenceRift,
  [BuildingType.ResourceDonkey]: BuildingTileIndex.Market,
  [BuildingType.ResourceKnightT1]: BuildingTileIndex.Barracks,
  [BuildingType.ResourceKnightT2]: BuildingTileIndex.Barracks,
  [BuildingType.ResourceKnightT3]: BuildingTileIndex.Barracks,
  [BuildingType.ResourceCrossbowmanT1]: BuildingTileIndex.ArcherRange,
  [BuildingType.ResourceCrossbowmanT2]: BuildingTileIndex.ArcherRange,
  [BuildingType.ResourceCrossbowmanT3]: BuildingTileIndex.ArcherRange,
  [BuildingType.ResourcePaladinT1]: BuildingTileIndex.Stable,
  [BuildingType.ResourcePaladinT2]: BuildingTileIndex.Stable,
  [BuildingType.ResourcePaladinT3]: BuildingTileIndex.Stable,
  [BuildingType.ResourceWheat]: BuildingTileIndex.Farm,
  [BuildingType.ResourceFish]: BuildingTileIndex.FishingVillage,
  [BuildingType.ResourceEssence]: BuildingTileIndex.Mine,
};

export enum UnitTileIndex {
  KnightT1 = 0,
  KnightT2 = 1,
  KnightT3 = 2,
  CrossbowmanT1 = 3,
  CrossbowmanT2 = 4,
  CrossbowmanT3 = 5,
  PaladinT1 = 6,
  PaladinT2 = 7,
  PaladinT3 = 8,
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
        default:
          return UnitTileIndex.KnightT1;
      }
    case TroopType.Crossbowman:
      switch (troopTier) {
        case TroopTier.T1:
          return UnitTileIndex.CrossbowmanT1;
        case TroopTier.T2:
          return UnitTileIndex.CrossbowmanT2;
        case TroopTier.T3:
          return UnitTileIndex.CrossbowmanT3;
        default:
          return UnitTileIndex.CrossbowmanT1;
      }
    case TroopType.Paladin:
      switch (troopTier) {
        case TroopTier.T1:
          return UnitTileIndex.PaladinT1;
        case TroopTier.T2:
          return UnitTileIndex.PaladinT2;
        case TroopTier.T3:
          return UnitTileIndex.PaladinT3;
        default:
          return UnitTileIndex.PaladinT1;
      }
    default:
      return UnitTileIndex.KnightT1;
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
