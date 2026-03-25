import type { Position, TileState } from "./common.js";

/**
 * Snapshot of map entities in a square area around a given center coordinate.
 */
export interface MapAreaView {
  center: Position;
  radius: number;
  tiles: TileState[];
}
