import { computeEffectiveStaminaCost } from "@/lib/army-stamina/path-cost";
import { pinsOrder } from "@/three/scenes/worldmap-order-request";
import { formatExact } from "@/ui/design-system/kit/amount";
import { ATTACK, EXPLORE, MOVE, STAMINA, TRANSFER, UNEXPLORED } from "@/ui/design-system/kit/words";
import {
  type ActionPath,
  ActionPaths,
  ActionType,
  computeExploreFoodCosts,
  computeTravelFoodCosts,
  type OrderRefusal,
} from "@bibliothecadao/eternum";
import type { Troops } from "@bibliothecadao/types";

type TileOrder = {
  path: ActionPath[] | undefined;
  /** What stands on the tile, as its card names it; an army when it is no site. */
  target: string | null;
  exploreStamina: number;
  /** The wheat the order burns from the army's realm (orderWheat). */
  wheat: number;
  /** Whether the tile has been revealed. */
  explored: boolean;
  /** Whether something stands on the tile an army could act on: a structure, an army, a crate. */
  occupied: boolean;
  /** Why the rules gave the selected army no order here, where they said (ActionPaths.getRefusals). */
  refusal: OrderRefusal | undefined;
  /** Seconds until the army holds a refused stamina need; undefined when that is unknown. */
  staminaWait: number | undefined;
  /** What the scoring orders pay, in victory points. */
  points: { exploreTile: number; openRelicCrate: number };
  /** Whether a click previews the order before the right-click sends it (the HUD that carries the order's verb). */
  clickPreviews: boolean;
};

export type OrderTip = {
  /** The right-click's order on the tile, what it costs and what it pays; or why there is none. */
  line: string;
  /** Where a click previews before the right-click sends. */
  gestures: string | null;
};

const SEPARATOR = " · ";
const RIGHT_CLICK = "Right-click";

/**
 * What a right-click on a tile does for the selected army, before any click: the order, its cost and its payoff, from
 * the order's own path and cost rules; or, where the rules give no order, why (the refusal they recorded, or a target
 * out of reach). The map's highlight colours mean the army's orders and nothing else; this line is their legend, and the
 * one place the game says which mouse button sends.
 */
export const orderTip = (order: TileOrder): OrderTip | null => {
  const line = orderLine(order);
  if (line !== null) return { line, gestures: order.clickPreviews && pinsOrder(order.path) ? CLICK_PREVIEWS : null };
  const refused = refusalLine(order);
  return refused === null ? null : { line: refused, gestures: null };
};

const orderLine = ({ path, target, exploreStamina, wheat, points }: TileOrder): string | null => {
  if (!path || path.length < 2) return null;
  const actionType = ActionPaths.getActionType(path);
  const stamina = `${formatExact(computeEffectiveStaminaCost(path.slice(1), actionType, exploreStamina))} ${STAMINA}`;
  const sends = (...pieces: Array<string | null>) =>
    pieces.filter((piece): piece is string => piece !== null).join(SEPARATOR);
  const food = wheat > 0 ? `${formatExact(Math.round(wheat))} wheat` : null;
  if (actionType === ActionType.Explore) return sends(RIGHT_CLICK, EXPLORE, stamina, food, scoring(points.exploreTile));
  if (actionType === ActionType.Move) return sends(RIGHT_CLICK, MOVE, stamina, food);
  // Neither click sends an attack unseen: the right-click opens its forecast.
  if (actionType === ActionType.Attack) return sends(target, RIGHT_CLICK, ATTACK, "forecast");
  if (actionType === ActionType.Chest) return sends(RIGHT_CLICK, "Open crate", scoring(points.openRelicCrate));
  if (actionType === ActionType.Help) return sends(target, RIGHT_CLICK, `${TRANSFER} troops`);
  if (actionType === ActionType.SpireTravel) return sends(RIGHT_CLICK, "Travel through the spire");
  return null;
};

/** Why no order leads here, or null where there is nothing to say (a revealed, empty tile out of reach). */
const refusalLine = ({ refusal, staminaWait, explored, occupied }: TileOrder): string | null => {
  if (refusal?.reason === "stamina") {
    const need = `Needs ${formatExact(refusal.need)} ${STAMINA}`;
    return staminaWait === undefined ? need : `${need}, ${readyIn(staminaWait)}`;
  }
  if (refusal?.reason === "food") return "Not enough food for the army";
  if (refusal?.reason === "off-limits") return "Only unclaimed structures can be attacked";
  if (occupied) return TOO_FAR;
  return explored ? null : [UNEXPLORED, TOO_FAR].join(SEPARATOR);
};

/** No rule refused the tile, yet no path leads there: it is beyond the army's step. */
const TOO_FAR = "Too far: move next to it";

const scoring = (points: number): string | null => (points > 0 ? `+${formatExact(points)} points` : null);

/** When the wait ends, in whole minutes rounded up. */
const readyIn = (seconds: number): string =>
  seconds < 60 ? "ready in under a minute" : `ready in ${Math.ceil(seconds / 60)} min`;

/** Where a click looks first (the HUD that carries the order's verb) and the right-click sends. */
const CLICK_PREVIEWS = "Click previews";

/**
 * The wheat an order burns from its army's realm, as the chain charges it: an explore's, or a move's for each step it
 * takes. Nothing for any other order.
 */
export const orderWheat = (path: ActionPath[] | undefined, troops: Pick<Troops, "category" | "count">) => {
  const actionType = path ? ActionPaths.getActionType(path) : undefined;
  if (actionType === ActionType.Explore) return Math.abs(computeExploreFoodCosts(troops).wheatPayAmount);
  if (actionType === ActionType.Move)
    return Math.abs(computeTravelFoodCosts(troops).wheatPayAmount * (path!.length - 1));
  return 0;
};
