import { HexPosition } from "@/types";
import { ID, StructureType } from "@bibliothecadao/eternum";

export type ArmySystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  isMine: boolean;
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
  hexCoords: HexPosition;
};

export type BuildingSystemUpdate = {
  buildingType: string;
  innerCol: number;
  innerRow: number;
};
