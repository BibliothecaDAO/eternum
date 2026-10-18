import { computeEffectiveStaminaCost } from "@/lib/army-stamina/path-cost";
import { pinsOrder } from "@/three/scenes/worldmap-order-request";
import { formatCharge, formatExact } from "@/ui/design-system/kit/amount";
import { formatWait } from "@/ui/design-system/kit/time";
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
  /** The food the order burns from the army's realm (orderFood). */
  food: OrderFood;
  /** Whether the tile has been revealed. */
  explored: boolean;
  /** Why the planner gave the selected army no order here (ActionPaths.getRefusals). */
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
 * the order's own path and cost rules; or, where the rules give no order, the reason the planner recorded. The map's
 * highlight colours mean the army's orders and nothing else; this line is their legend, and the one place the game says
 * which mouse button sends.
 */
export const orderTip = (order: TileOrder): OrderTip | null => {
  const line = orderLine(order);
  if (line !== null) return { line, gestures: order.clickPreviews && pinsOrder(order.path) ? CLICK_PREVIEWS : null };
  const refused = refusalLine(order);
  return refused === null ? null : { line: refused, gestures: null };
};

const orderLine = ({ path, target, exploreStamina, food, points }: TileOrder): string | null => {
  if (!path || path.length < 2) return null;
  const actionType = ActionPaths.getActionType(path);
  const stamina = `${formatExact(computeEffectiveStaminaCost(path.slice(1), actionType, exploreStamina))} ${STAMINA}`;
  const sends = (...pieces: Array<string | null>) =>
    pieces.filter((piece): piece is string => piece !== null).join(SEPARATOR);
  if (actionType === ActionType.Explore)
    return sends(RIGHT_CLICK, EXPLORE, stamina, ...charges(food), scoring(points.exploreTile));
  if (actionType === ActionType.Move) return sends(RIGHT_CLICK, MOVE, stamina, ...charges(food));
  // Neither click sends an attack unseen: the right-click opens its forecast.
  if (actionType === ActionType.Attack) return sends(target, RIGHT_CLICK, ATTACK, "forecast");
  if (actionType === ActionType.Chest) return sends(RIGHT_CLICK, "Open crate", scoring(points.openRelicCrate));
  if (actionType === ActionType.Help) return sends(target, RIGHT_CLICK, `${TRANSFER} troops`);
  if (actionType === ActionType.SpireTravel) return sends(RIGHT_CLICK, "Travel through the spire");
  return null;
};

/** Each food the order charges, as the chain charges it; none where it charges nothing. */
const charges = ({ wheat, fish }: OrderFood): string[] => [
  ...(wheat > 0 ? [`${formatCharge(wheat)} wheat`] : []),
  ...(fish > 0 ? [`${formatCharge(fish)} fish`] : []),
];

/**
 * Why no order leads here, as the planner recorded it; a fogged tile it said nothing of is only unexplored, and a
 * revealed one it said nothing of has nothing to say.
 */
const refusalLine = ({ refusal, staminaWait, explored }: TileOrder): string | null => {
  if (refusal?.reason === "stamina") {
    const need = `Needs ${formatExact(refusal.need)} ${STAMINA}`;
    return staminaWait === undefined ? need : `${need}, ${readyIn(staminaWait)}`;
  }
  if (refusal) return REFUSALS[refusal.reason];
  return explored ? null : UNEXPLORED;
};

const REFUSALS: Record<Exclude<OrderRefusal["reason"], "stamina">, string> = {
  food: "Not enough food for the army",
  "off-limits": "Only unclaimed structures can be attacked",
  "no-transfer": "This game allows no transfer here",
  occupied: "No army can enter this tile",
  "too-far": "Too far: move next to it",
};

const scoring = (points: number): string | null => (points > 0 ? `+${formatExact(points)} points` : null);

/** When the wait ends, to the second while it is short. */
const readyIn = (seconds: number): string => `ready in ${formatWait(seconds)}`;

/** Where a click looks first (the HUD that carries the order's verb) and the right-click sends. */
const CLICK_PREVIEWS = "Click previews";

/** The wheat and fish an order burns from its army's realm. */
type OrderFood = { wheat: number; fish: number };

/**
 * The food an order burns from its army's realm, as the chain charges it: an explore's, or a move's for each step it
 * takes. Nothing for any other order.
 */
export const orderFood = (path: ActionPath[] | undefined, troops: Pick<Troops, "category" | "count">): OrderFood => {
  const actionType = path ? ActionPaths.getActionType(path) : undefined;
  if (actionType === ActionType.Explore) return foodFor(computeExploreFoodCosts(troops), 1);
  if (actionType === ActionType.Move) return foodFor(computeTravelFoodCosts(troops), path!.length - 1);
  return { wheat: 0, fish: 0 };
};

const foodFor = (cost: { wheatPayAmount: number; fishPayAmount: number }, steps: number): OrderFood => ({
  wheat: Math.abs(cost.wheatPayAmount * steps),
  fish: Math.abs(cost.fishPayAmount * steps),
});
