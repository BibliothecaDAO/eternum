import { HexPosition } from "@/types";
import { Position } from "@/types/Position";
import { ID, StructureType } from "@bibliothecadao/eternum";
import { StructureProgress } from "../scenes/constants";

export type ArmySystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  isMine: boolean;
  battleId: ID;
  defender: boolean;
  currentHealth: bigint;
  order: number;
};

export type StructureSystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  structureType: StructureType;
  isMine: boolean;
  stage: StructureProgress;
  level: number;
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
