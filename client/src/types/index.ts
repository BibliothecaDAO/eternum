export interface Hexagon {
  idx: number;
  col: number;
  row: number;
  biome: string;
  explored: boolean | undefined;
  // address
  exploredBy: bigint | undefined;
}

export type Position3D = [number, number, number];

export interface ClickedHex {
  contractPos: { col: number; row: number };
  uiPos: Position3D;
  hexIndex: number;
}

export interface HighlightPosition {
  pos: Position3D;
  color: number;
}
