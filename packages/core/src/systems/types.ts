import {
  BiomeType,
  BuildingType,
  HexPosition,
  ID,
  QuestType,
  RelicEffectWithEndTick,
  ResourcesIds,
  StructureType,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import type { ActiveProduction, GuardArmy } from "../stores/map-data-store";
import { Position } from "./position";

// data that you can get from the tile + mapdatastore
export type ArmySystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  troopType: TroopType;
  troopTier: TroopTier;
  isDaydreamsAgent: boolean;
  // Enhanced data from MapDataStore
  ownerName: string;
  guildName: string;
  troopCount?: number | undefined;
  ownerAddress: bigint;
  currentStamina?: number | undefined;
  maxStamina?: number | undefined;
  onChainStamina?:
    | {
        amount: bigint;
        updatedTick: number;
      }
    | undefined;
};

// data that you can get only from the explorer troops
export type ExplorerTroopsSystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  troopCount: number;
  onChainStamina: {
    amount: bigint;
    updatedTick: number;
  };
  ownerAddress: bigint;
  ownerName: string;
};

export type StructureSystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  structureType: StructureType;
  stage: StructureProgress;
  initialized: boolean;
  level: number;
  isAlly: boolean;
  owner: { address: bigint | undefined; ownerName: string; guildName: string };
  hasWonder: boolean;
  // Enhanced data from MapDataStore
  guardArmies?: GuardArmy[];
  activeProductions?: ActiveProduction[];
  hyperstructureRealmCount?: number;
};

export type TileSystemUpdate = {
  hexCoords: HexPosition;
  removeExplored: boolean;
  biome: BiomeType;
};

export type BuildingSystemUpdate = {
  buildingType: BuildingType;
  innerCol: number;
  innerRow: number;
  paused: boolean;
};

export type ExplorerMoveSystemUpdate = {
  explorerId: ID;
  resourceId: ResourcesIds | 0;
  amount: number;
};
export type RealmSystemUpdate = {
  level: number;
  hexCoords: HexPosition;
};

export type QuestSystemUpdate = {
  entityId: ID;
  occupierId: ID;
  hexCoords: HexPosition;
};

export type ChestSystemUpdate = {
  occupierId: ID;
  hexCoords: HexPosition;
};

export type RelicEffectSystemUpdate = {
  entityId: ID;
  relicEffects: RelicEffectWithEndTick[];
};


export interface QuestData {
  entityId: ID;
  questType: QuestType;
  occupierId: ID;
  hexCoords: Position;
}

export interface ChestData {
  entityId: ID;
  hexCoords: Position;
}

export interface SelectableArmy {
  entityId: ID;
  position: HexPosition;
  name: string;
}
export enum StructureProgress {
  STAGE_1 = 0,
  STAGE_2 = 1,
  STAGE_3 = 2,
}