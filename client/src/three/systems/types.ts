import { HexPosition } from "@/types";
import { ID, StructureType } from "@bibliothecadao/eternum";
import { StructureProgress } from "../scenes/constants";

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
  stage: StructureProgress;
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
