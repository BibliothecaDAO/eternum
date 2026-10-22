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
  Chest = "chest",
  /** A site beside the army that it uses where it stands: a shrine or a well. */
  UseSite = "use_site",
  CreateArmy = "create_army",
}

const sameStep = (left: ActionPath, right: ActionPath): boolean =>
  left.hex.col === right.hex.col &&
  left.hex.row === right.hex.row &&
  left.actionType === right.actionType &&
  left.biomeType === right.biomeType &&
  left.staminaCost === right.staminaCost;

/**
 * Why the rules gave an actor no order at a tile they looked at, as the planner established it: the stamina the order
 * needs (the smallest any route there needs), the owner's food for it, a structure the game lets no army attack, a
 * holding the game allows no transfer with, a site that holds its tile, or a target beyond the army's step.
 */
export type OrderRefusal =
  | { reason: "stamina"; need: number }
  | { reason: "food" }
  | { reason: "off-limits" }
  | { reason: "no-transfer" }
  | { reason: "occupied" }
  | { reason: "too-far" };

export class ActionPaths {
  private readonly paths: Map<string, ActionPath[]>;
  private readonly refusals = new Map<string, OrderRefusal>();
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

  /**
   * Records why a tile offers no order, as the rule that withheld it decided. A rule's refusal stands; between
   * stamina shortfalls the smallest need wins, since that route is the first to open.
   */
  refuse(key: string, refusal: OrderRefusal): void {
    const held = this.refusals.get(key);
    if (held && (held.reason !== "stamina" || (refusal.reason === "stamina" && held.need <= refusal.need))) return;
    this.refusals.set(key, refusal);
  }

  /** Why each tile the rules looked at has no order; a tile some route reaches has none to give. */
  getRefusals(): Map<string, OrderRefusal> {
    return new Map([...this.refusals].filter(([key]) => !this.paths.has(key)));
  }

  /** Whether the rules gave the tile an order or a reason. */
  decided(key: string): boolean {
    return this.paths.has(key) || this.refusals.has(key);
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

  /** Whether two sets of paths offer the same orders, step for step. */
  static samePaths(left: ReadonlyMap<string, ActionPath[]>, right: ReadonlyMap<string, ActionPath[]>): boolean {
    if (left.size !== right.size) return false;
    for (const [key, path] of left) {
      const other = right.get(key);
      if (!other || other.length !== path.length) return false;
      if (!path.every((step, index) => sameStep(step, other[index]))) return false;
    }
    return true;
  }

  static getActionType(path: ActionPath[]): ActionType | undefined {
    if (path.length === 0) return undefined;
    return path[path.length - 1].actionType;
  }
}
