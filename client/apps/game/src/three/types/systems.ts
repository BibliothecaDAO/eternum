import {
  BiomeType,
  BuildingType,
  HexPosition,
  ID,
  RelicEffect,
  ResourcesIds,
  StructureType,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { StructureProgress } from "./common";

export type ArmySystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  order: number;
  troopType: TroopType;
  troopTier: TroopTier;
  owner: { address: bigint; ownerName: string; guildName: string };
  isDaydreamsAgent: boolean;
  isAlly: boolean;
};

export type StructureSystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  structureType: StructureType;
  stage: StructureProgress;
  initialized: boolean;
  level: number;
  isAlly: boolean;
  owner: { address: bigint; ownerName: string; guildName: string };
  hasWonder: boolean;
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

export type ExplorerRewardSystemUpdate = {
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
  relicResourceId: ResourcesIds;
  isActive: boolean;
  effect: RelicEffect;
};
