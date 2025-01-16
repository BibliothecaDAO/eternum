import { ID, StructureType, type HexPosition } from "@bibliothecadao/eternum";
import { StructureProgress } from "../";
import { Position } from "./position";

export type ArmySystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  battleId: ID;
  defender: boolean;
  currentHealth: bigint;
  order: number;
  owner: { address: bigint; ownerName: string; guildName: string };
};

export type StructureSystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  structureType: StructureType;
  stage: StructureProgress;
  level: number;
  owner: { address: bigint };
  hasWonder: boolean;
};

export type TileSystemUpdate = {
  hexCoords: HexPosition;
  removeExplored: boolean;
};

export type BattleSystemUpdate = {
  entityId: ID;
  hexCoords: Position;
  isEmpty: boolean;
  deleted: boolean;
  isSiege: boolean;
  isOngoing: boolean;
};

export type BuildingSystemUpdate = {
  buildingType: string;
  innerCol: number;
  innerRow: number;
  paused: boolean;
};

export type RealmSystemUpdate = {
  level: number;
  hexCoords: HexPosition;
};

export type BattleViewInfo = {
  battleEntityId: ID | undefined;
  engage?: boolean;
  ownArmyEntityId: ID | undefined;
  targetArmy: ID | undefined;
};

export interface StructureInfo {
  entityId: ID;
  hexCoords: { col: number; row: number };
  stage: number;
  level: number;
  isMine: boolean;
  owner: { address: bigint };
  structureType: StructureType;
  hasWonder: boolean;
}

export enum RightView {
  None,
  ResourceTable,
}

export enum LeftView {
  None,
  MilitaryView,
  EntityView,
  ConstructionView,
  WorldStructuresView,
  ResourceArrivals,
  ResourceTable,
}
