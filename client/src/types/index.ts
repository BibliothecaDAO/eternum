import { ContractAddress, Position } from "@bibliothecadao/eternum";

export interface Hexagon {
  idx: number;
  col: number;
  row: number;
  biome: string;
  explored: boolean | undefined;
  exploredBy: ContractAddress | undefined;
}

type Position3D = [number, number, number];
type Position2D = [number, number];
export type HexPosition = { col: number; row: number };
export interface ClickedHex {
  contractPos: HexPosition;
  uiPos: Position3D;
  hexIndex: number;
}

export interface HighlightPositions {
  pos: Position2D[];
  color: number;
}

export interface TravelPath {
  path: Position[];
  isExplored: boolean;
}

export interface Health {
  current: bigint;
  lifetime: bigint;
}
