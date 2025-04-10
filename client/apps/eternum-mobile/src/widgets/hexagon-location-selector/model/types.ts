export interface HexLocation {
  col: number;
  row: number;
}

export type HexState = "available" | "occupied" | "selected";

export interface CanvasConfig {
  width: number;
  height: number;
  hexSize: number;
}
