export interface Hexagon {
  idx: number;
  col: number;
  row: number;
  biome: string;
  explored: boolean | undefined;
  // address
  exploredBy: bigint | undefined;
}

export interface ClickedHex {
  contractPos: { col: number; row: number };
  uiPos: [number, number, number];
  hexIndex: number;
}

export interface HighlightPosition {
  pos: [number, number, number];
  color: number;
}
