import { FELT_CENTER } from "../constants";
import { HexPosition } from "../types";

export class TravelPaths {
  private readonly paths: Map<string, { path: HexPosition[]; isExplored: boolean }>;

  constructor() {
    this.paths = new Map();
  }

  set(key: string, value: { path: HexPosition[]; isExplored: boolean }): void {
    this.paths.set(key, value);
  }

  deleteAll(): void {
    this.paths.clear();
  }

  get(key: string): { path: HexPosition[]; isExplored: boolean } | undefined {
    return this.paths.get(key);
  }

  has(key: string): boolean {
    return this.paths.has(key);
  }

  values(): IterableIterator<{ path: HexPosition[]; isExplored: boolean }> {
    return this.paths.values();
  }

  getHighlightedHexes(): Array<{ col: number; row: number }> {
    return Array.from(this.paths.values()).map(({ path }) => ({
      col: path[path.length - 1].col - FELT_CENTER,
      row: path[path.length - 1].row - FELT_CENTER,
    }));
  }

  isHighlighted(row: number, col: number): boolean {
    return this.paths.has(TravelPaths.posKey({ col: col + FELT_CENTER, row: row + FELT_CENTER }));
  }

  getPaths(): Map<string, { path: HexPosition[]; isExplored: boolean }> {
    return this.paths;
  }

  static posKey(pos: HexPosition, normalized = false): string {
    const col = normalized ? pos.col + FELT_CENTER : pos.col;
    const row = normalized ? pos.row + FELT_CENTER : pos.row;
    return `${col},${row}`;
  }
}
