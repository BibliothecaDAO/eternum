import { BiomeType, HexPosition } from "@bibliothecadao/types";
import { resolveActionHighlightDescriptors, type ActionHighlightDescriptor } from "./action-highlight-descriptors";
import { FELT_CENTER } from "./utils";

export type ActionPath = {
  hex: HexPosition;
  actionType: ActionType;
  biomeType?: BiomeType;
  staminaCost?: number;
};

export enum ActionType {
  Move = "move",
  Attack = "attack",
  SpireTravel = "spire_travel",
  Build = "build",
  Help = "help",
  Explore = "explore",
  Quest = "quest",
  Chest = "chest",
  CreateArmy = "create_army",
}

export class ActionPaths {
  private readonly paths: Map<string, ActionPath[]>;
  private readonly FELT_CENTER: number;
  constructor() {
    this.paths = new Map();
    this.FELT_CENTER = FELT_CENTER();
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

  getHighlightDescriptors(): ActionHighlightDescriptor[] {
    return resolveActionHighlightDescriptors(this.paths.values(), this.FELT_CENTER);
  }

  getHighlightedHexes(): ActionPath[] {
    return this.getHighlightDescriptors().map((descriptor) => ({
      hex: descriptor.hex,
      actionType: descriptor.actionType,
    }));
  }

  isHighlighted(row: number, col: number): boolean {
    return this.paths.has(ActionPaths.posKey({ col: col + this.FELT_CENTER, row: row + this.FELT_CENTER }));
  }

  getPaths(): Map<string, ActionPath[]> {
    return this.paths;
  }

  static posKey(pos: HexPosition, normalized = false): string {
    const col = normalized ? pos.col + FELT_CENTER() : pos.col;
    const row = normalized ? pos.row + FELT_CENTER() : pos.row;
    return `${col},${row}`;
  }

  static getActionType(path: ActionPath[]): ActionType | undefined {
    if (path.length === 0) return undefined;
    return path[path.length - 1].actionType;
  }
}
