import { BiomeType, FELT_CENTER, HexPosition } from "@bibliothecadao/types";

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
  Help = "help",
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
    const seen = new Set<string>();
    return Array.from(this.paths.values()).flatMap((path) => {
      // Skip first element of each path
      const remainingPath = path.slice(1);
      return remainingPath
        .map((hex) => {
          const col = hex.hex.col - FELT_CENTER;
          const row = hex.hex.row - FELT_CENTER;
          const key = `${col},${row}`;
          if (seen.has(key)) {
            return null;
          }
          seen.add(key);
          return {
            hex: { col, row },
            actionType: hex.actionType,
          };
        })
        .filter((hex): hex is ActionPath => hex !== null);
    });
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

  static getActionType(path: ActionPath[]): ActionType | undefined {
    if (path.length === 0) return undefined;
    return path[path.length - 1].actionType;
  }
}
