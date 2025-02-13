import { FELT_CENTER } from "../constants";
import { HexPosition, HexTileInfo } from "../types";

export type ActionPaths = {
  hex: HexPosition;
  actionType: ActionType;
}[];

export enum ActionType {
  Move = "move",
  Attack = "attack",
  Build = "build",
  Merge = "merge",
  Explore = "explore",
}

export class TravelPaths {
  private readonly paths: Map<string, { path: HexTileInfo[]; isExplored: boolean }>;

  constructor() {
    this.paths = new Map();
  }

  set(key: string, value: { path: HexTileInfo[]; isExplored: boolean }): void {
    this.paths.set(key, value);
  }

  deleteAll(): void {
    this.paths.clear();
  }

  get(key: string): { path: HexTileInfo[]; isExplored: boolean } | undefined {
    return this.paths.get(key);
  }

  has(key: string): boolean {
    return this.paths.has(key);
  }

  values(): IterableIterator<{ path: HexTileInfo[]; isExplored: boolean }> {
    return this.paths.values();
  }

  getHighlightedHexes(): ActionPaths {
    return Array.from(this.paths.values()).flatMap(({ path, isExplored }) =>
      path.map((hex) => ({
        hex: {
          col: hex.col - FELT_CENTER,
          row: hex.row - FELT_CENTER,
        },
        actionType: isExplored ? ActionType.Explore : ActionType.Move,
      })),
    );
  }

  isHighlighted(row: number, col: number): boolean {
    return this.paths.has(TravelPaths.posKey({ col: col + FELT_CENTER, row: row + FELT_CENTER }));
  }

  getPaths(): Map<string, { path: HexTileInfo[]; isExplored: boolean }> {
    return this.paths;
  }

  static posKey(pos: HexPosition, normalized = false): string {
    const col = normalized ? pos.col + FELT_CENTER : pos.col;
    const row = normalized ? pos.row + FELT_CENTER : pos.row;
    return `${col},${row}`;
  }
}
