import { HexPosition } from "@/types";
import { Position } from "@/types/Position";
import { ID, StructureType } from "@bibliothecadao/eternum";

export type ArmySystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  isMine: boolean;
  battleId: ID;
  currentHealth: bigint;
};

export type StructureSystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  structureType: StructureType;
  isMine: boolean;
};

export type TileSystemUpdate = {
  hexCoords: HexPosition;
};

export type BattleSystemUpdate = {
  entityId: ID;
  hexCoords: Position;
  isEmpty: boolean;
};
