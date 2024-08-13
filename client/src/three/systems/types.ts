import { HexPosition } from "@/types";
import { ID, StructureType } from "@bibliothecadao/eternum";

export type ArmySystemUpdate = {
  entityId: ID;
  hexCoords: HexPosition;
  isMine: boolean;
  battleId: ID;
  health: { lifetime: bigint; current: bigint };
  defender: boolean;
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
  isEmpty: boolean;
};
