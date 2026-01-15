import {
  ClientComponents,
  type ID,
  RealmLevels,
  StructureType,
  TileOccupier,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";
import { getHyperstructureProgress } from "../utils";
import { PROGRESS_FINAL_THRESHOLD, PROGRESS_HALF_THRESHOLD } from "../utils/constants";
import { StructureProgress } from "./types";

export const getStructureStage = (structureType: StructureType, entityId: ID, components: ClientComponents): number => {
  if (structureType === StructureType.Hyperstructure) {
    const { initialized, percentage } = getHyperstructureProgress(entityId, components);

    if (!initialized) {
      return StructureProgress.STAGE_1;
    }

    if (percentage < PROGRESS_HALF_THRESHOLD) {
      return StructureProgress.STAGE_1;
    }
    if (percentage < PROGRESS_FINAL_THRESHOLD && percentage >= PROGRESS_HALF_THRESHOLD) {
      return StructureProgress.STAGE_2;
    }
    return StructureProgress.STAGE_3;
  }

  return StructureProgress.STAGE_1;
};

export const getExplorerInfoFromTileOccupier = (
  occupierType: number,
): { troopType: TroopType; troopTier: TroopTier; isDaydreamsAgent: boolean } | undefined => {
  switch (occupierType) {
    case TileOccupier.ExplorerKnightT1Regular:
      return { troopType: "Knight" as TroopType, troopTier: "T1" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerKnightT1Daydreams:
      return { troopType: "Knight" as TroopType, troopTier: "T1" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerKnightT2Regular:
      return { troopType: "Knight" as TroopType, troopTier: "T2" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerKnightT2Daydreams:
      return { troopType: "Knight" as TroopType, troopTier: "T2" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerKnightT3Regular:
      return { troopType: "Knight" as TroopType, troopTier: "T3" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerKnightT3Daydreams:
      return { troopType: "Knight" as TroopType, troopTier: "T3" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerPaladinT1Regular:
      return { troopType: "Paladin" as TroopType, troopTier: "T1" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerPaladinT1Daydreams:
      return { troopType: "Paladin" as TroopType, troopTier: "T1" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerPaladinT2Regular:
      return { troopType: "Paladin" as TroopType, troopTier: "T2" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerPaladinT2Daydreams:
      return { troopType: "Paladin" as TroopType, troopTier: "T2" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerPaladinT3Regular:
      return { troopType: "Paladin" as TroopType, troopTier: "T3" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerPaladinT3Daydreams:
      return { troopType: "Paladin" as TroopType, troopTier: "T3" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerCrossbowmanT1Regular:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T1" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerCrossbowmanT1Daydreams:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T1" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerCrossbowmanT2Regular:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T2" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerCrossbowmanT2Daydreams:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T2" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerCrossbowmanT3Regular:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T3" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerCrossbowmanT3Daydreams:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T3" as TroopTier, isDaydreamsAgent: true };

    default:
      return undefined;
  }
};

export const getStructureInfoFromTileOccupier = (
  occupierType: number,
): { type: StructureType; stage: StructureProgress; level: number; hasWonder: boolean } | undefined => {
  switch (occupierType) {
    case TileOccupier.RealmRegularLevel1:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Settlement,
        hasWonder: false,
      };
    case TileOccupier.RealmRegularLevel2:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: RealmLevels.City, hasWonder: false };
    case TileOccupier.RealmRegularLevel3:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Kingdom,
        hasWonder: false,
      };
    case TileOccupier.RealmRegularLevel4:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Empire,
        hasWonder: false,
      };
    case TileOccupier.RealmWonderLevel1:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Settlement,
        hasWonder: true,
      };
    case TileOccupier.RealmWonderLevel2:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: RealmLevels.City, hasWonder: true };
    case TileOccupier.RealmWonderLevel3:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Kingdom,
        hasWonder: true,
      };
    case TileOccupier.RealmWonderLevel4:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Empire,
        hasWonder: true,
      };

    case TileOccupier.HyperstructureLevel1:
      return { type: StructureType.Hyperstructure, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };
    case TileOccupier.HyperstructureLevel2:
      return { type: StructureType.Hyperstructure, stage: StructureProgress.STAGE_2, level: 1, hasWonder: false };
    case TileOccupier.HyperstructureLevel3:
      return { type: StructureType.Hyperstructure, stage: StructureProgress.STAGE_3, level: 1, hasWonder: false };

    case TileOccupier.FragmentMine:
      return { type: StructureType.FragmentMine, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };

    case TileOccupier.Village:
      return {
        type: StructureType.Village,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Settlement,
        hasWonder: false,
      };
    case TileOccupier.Bank:
      return { type: StructureType.Bank, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };

    default:
      return undefined;
  }
};
