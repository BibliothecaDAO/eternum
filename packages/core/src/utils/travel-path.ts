import { HexPosition, HexTileInfo } from "@bibliothecadao/types";
import { FELT_CENTER } from "./utils";

export class TravelPaths {
  private readonly paths: Map<string, { path: HexTileInfo[]; isExplored: boolean }>;
  private readonly FELT_CENTER: number;
  constructor() {
    this.paths = new Map();
    this.FELT_CENTER = FELT_CENTER();
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

  getHighlightedHexes(): Array<{ col: number; row: number }> {
    return Array.from(this.paths.values()).map(({ path }) => ({
      col: path[path.length - 1].col - this.FELT_CENTER,
      row: path[path.length - 1].row - this.FELT_CENTER,
    }));
  }

  isHighlighted(row: number, col: number): boolean {
    return this.paths.has(TravelPaths.posKey({ col: col + this.FELT_CENTER, row: row + this.FELT_CENTER }));
  }

  getPaths(): Map<string, { path: HexTileInfo[]; isExplored: boolean }> {
    return this.paths;
  }

  static posKey(pos: HexPosition, normalized = false): string {
    const col = normalized ? pos.col + FELT_CENTER() : pos.col;
    const row = normalized ? pos.row + FELT_CENTER() : pos.row;
    return `${col},${row}`;
  }
}
