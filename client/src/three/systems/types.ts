import { HexPosition } from "@/types";
import { StructureType } from "@bibliothecadao/eternum";

export type ArmySystemUpdate = {
  entityId: number;
  hexCoords: HexPosition;
  isMine: boolean;
};

export type StructureSystemUpdate = {
  entityId: number;
  hexCoords: HexPosition;
  structureType: StructureType;
  isMine: boolean;
};

export type TileSystemUpdate = {
  hexCoords: HexPosition;
};
