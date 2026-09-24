import {
  type ID,
  RealmLevels,
  StructureType,
  TileOccupier,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { getHyperstructureProgress } from "../utils";
import { PROGRESS_FINAL_THRESHOLD, PROGRESS_HALF_THRESHOLD } from "../utils/constants";
import { StructureProgress } from "./types";

export const getStructureStage = (structureType: StructureType, entityId: ID, store: NativeFactStore): number => {
  if (structureType === StructureType.Hyperstructure) {
    const { initialized, percentage } = getHyperstructureProgress(entityId, store);

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
): { troopType: TroopType; troopTier: TroopTier } | undefined => {
  switch (occupierType) {
    case TileOccupier.ExplorerKnightT1Regular:
      return { troopType: "Knight" as TroopType, troopTier: "T1" as TroopTier };

    case TileOccupier.ExplorerKnightT2Regular:
      return { troopType: "Knight" as TroopType, troopTier: "T2" as TroopTier };

    case TileOccupier.ExplorerKnightT3Regular:
      return { troopType: "Knight" as TroopType, troopTier: "T3" as TroopTier };

    case TileOccupier.ExplorerPaladinT1Regular:
      return { troopType: "Paladin" as TroopType, troopTier: "T1" as TroopTier };

    case TileOccupier.ExplorerPaladinT2Regular:
      return { troopType: "Paladin" as TroopType, troopTier: "T2" as TroopTier };

    case TileOccupier.ExplorerPaladinT3Regular:
      return { troopType: "Paladin" as TroopType, troopTier: "T3" as TroopTier };

    case TileOccupier.ExplorerCrossbowmanT1Regular:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T1" as TroopTier };

    case TileOccupier.ExplorerCrossbowmanT2Regular:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T2" as TroopTier };

    case TileOccupier.ExplorerCrossbowmanT3Regular:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T3" as TroopTier };

    default:
      return undefined;
  }
};

export const getStructureInfoFromTileOccupier = (
  occupierType: number,
):
  | { type: StructureType; stage: StructureProgress; level: number; hasWonder: boolean; reserved?: true }
  | undefined => {
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

    case TileOccupier.Hyperstructure:
      return { type: StructureType.Hyperstructure, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };
    case TileOccupier.ReservedHyperstructure:
      return {
        type: StructureType.Hyperstructure,
        stage: StructureProgress.STAGE_1,
        level: 1,
        hasWonder: false,
        reserved: true,
      };

    case TileOccupier.Mine:
      return { type: StructureType.Mine, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };

    case TileOccupier.Village:
      return {
        type: StructureType.Village,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Settlement,
        hasWonder: false,
      };
    case TileOccupier.Bank:
      return { type: StructureType.Bank, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };
    case TileOccupier.Camp:
      return { type: StructureType.Camp, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };
    case TileOccupier.BitcoinMine:
      return { type: StructureType.BitcoinMine, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };

    default:
      return undefined;
  }
};
