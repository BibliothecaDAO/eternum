import { formatExact } from "@/ui/design-system/kit/amount";
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
  /** Whether the tile has been revealed. */
  explored: boolean;
  /** Why the planner gave the selected army no order here (ActionPaths.getRefusals). */
  refusal: OrderRefusal | undefined;
  /** Seconds until the army holds a refused stamina need; undefined when that is unknown. */
  staminaWait: number | undefined;
};

/**
 * What a right-click on a tile does for the selected army, before any click: the order alone ("Open crate"), with no
 * description and no payoff (owner, sheet round 5); or, where the rules give no order, the reason the planner
 * recorded. The map's highlight colours mean the army's orders and nothing else; this line is their legend.
 */
export const orderTip = (order: TileOrder): string | null => orderLine(order) ?? refusalLine(order);

const ORDERS: Partial<Record<ActionType, string>> = {
  [ActionType.Explore]: EXPLORE,
  [ActionType.Move]: MOVE,
  [ActionType.Attack]: ATTACK,
  [ActionType.Chest]: "Open crate",
  [ActionType.Help]: `${TRANSFER} troops`,
  [ActionType.SpireTravel]: "Travel through the spire",
};

const orderLine = ({ path }: TileOrder): string | null => {
  const actionType = path && path.length >= 2 ? ActionPaths.getActionType(path) : undefined;
  return actionType === undefined ? null : (ORDERS[actionType] ?? null);
};

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

/** When the wait ends, to the second while it is short. */
const readyIn = (seconds: number): string => `ready in ${formatWait(seconds)}`;

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
