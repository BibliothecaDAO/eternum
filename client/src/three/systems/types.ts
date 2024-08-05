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
