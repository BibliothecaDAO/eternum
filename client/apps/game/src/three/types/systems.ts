import {
  BiomeType,
  BuildingType,
  HexPosition,
  ID,
  RelicEffectWithEndTick,
  ResourcesIds,
  StructureType,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import type { ActiveProduction, GuardArmy } from "../managers/map-data-store";
import { StructureProgress } from "./common";

export type ArmySystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  order: number;
  troopType: TroopType;
  troopTier: TroopTier;
  owner: { address: bigint | undefined; ownerName: string; guildName: string };
  isDaydreamsAgent: boolean;
  isAlly: boolean;
  // Enhanced data from MapDataStore
  troopCount: number;
  currentStamina: (currentArmiesTick: number) => number;
  maxStamina: number;
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
