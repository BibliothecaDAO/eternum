import { BiomeType, FELT_CENTER } from "../constants";
import { HexPosition } from "../types";

export type ActionPath = {
  hex: HexPosition;
  actionType: ActionType;
  biomeType?: BiomeType;
  staminaCost?: number;
};

export enum ActionType {
  Move = "move",
  Attack = "attack",
  Build = "build",
  Merge = "merge",
  Explore = "explore",
}

export class ActionPaths {
  private readonly paths: Map<string, ActionPath[]>;

  constructor() {
    this.paths = new Map();
  }

  set(key: string, value: ActionPath[]): void {
    this.paths.set(key, value);
  }

  deleteAll(): void {
    this.paths.clear();
  }

  get(key: string): ActionPath[] | undefined {
    return this.paths.get(key);
  }

  has(key: string): boolean {
    return this.paths.has(key);
  }

  values(): IterableIterator<ActionPath[]> {
    return this.paths.values();
  }

  getHighlightedHexes(): ActionPath[] {
    return Array.from(this.paths.values()).flatMap((path) =>
      path.map((hex) => ({
        hex: {
          col: hex.hex.col - FELT_CENTER,
          row: hex.hex.row - FELT_CENTER,
        },
        actionType: hex.actionType,
      })),
    );
  }

  isHighlighted(row: number, col: number): boolean {
    return this.paths.has(ActionPaths.posKey({ col: col + FELT_CENTER, row: row + FELT_CENTER }));
  }

  getPaths(): Map<string, ActionPath[]> {
    return this.paths;
  }

  static posKey(pos: HexPosition, normalized = false): string {
    const col = normalized ? pos.col + FELT_CENTER : pos.col;
    const row = normalized ? pos.row + FELT_CENTER : pos.row;
    return `${col},${row}`;
  }
}
