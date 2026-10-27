import { formatCharge } from "@bibliothecadao/types";
import { computeEffectiveStaminaCost } from "@/lib/army-stamina/path-cost";
import { staminaShortfall } from "@/ui/design-system/kit/reasons";
import { ATTACK, EXPLORE, MOVE, STAMINA, TRANSFER, UNEXPLORED, USE } from "@/ui/design-system/kit/words";
import { type MapSiteKind, siteGainLine } from "../sites/map-site-plan";
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
  /** What an explore costs in stamina where its path names none (the game's explore cost). */
  exploreStamina: number;
  /** The food the order burns from the army's realm (orderFood). */
  food: OrderFood;
  /** Whether the tile has been revealed. */
  explored: boolean;
  /** Why the planner gave the selected army no order here (ActionPaths.getRefusals). */
  refusal: OrderRefusal | undefined;
  /** Seconds until the army holds a refused stamina need; undefined when that is unknown. */
  staminaWait: number | undefined;
  /** The stamina the army holds now, for a refused stamina need; undefined when that is unknown. */
  staminaHeld: number | undefined;
  /** The site a Use order uses: its kind, what one use gives, and the army's bar a Well fills; undefined elsewhere. */
  site:
    | { kind: MapSiteKind; gain: number | undefined; stamina: { current: number; max: number } | undefined }
    | undefined;
};

export type OrderTip = {
  /** The right-click's order ("Explore"), or why there is none. */
  line: string;
  /**
   * What the order costs, exactly as it is charged ("30 stamina · 100 wheat"), or for a site's Use, which costs
   * nothing, what it gives ("+200 XP"); none for a refusal or a crate.
   */
  cost: string | null;
};

/**
 * What a right-click on a tile does for the selected army, before any click: the order, and under it one compact line
 * of what it costs from the order's own cost rules (owner, sheet round 5: no gesture, no description, no payoff; a
 * crate is its action alone, as is a spire's entry, priced on its card); or, where the rules give no order, the reason
 * the planner recorded. The map's highlight colours mean the army's orders and nothing else; this line is their legend.
 */
export const orderTip = (order: TileOrder): OrderTip | null => {
  const ordered = orderOf(order);
  if (ordered) return ordered;
  const refused = refusalLine(order);
  return refused === null ? null : { line: refused, cost: null };
};

const OPEN_CRATE = "Open crate";

const ORDERS: Partial<Record<ActionType, string>> = {
  [ActionType.Explore]: EXPLORE,
  [ActionType.Move]: MOVE,
  [ActionType.Attack]: ATTACK,
  [ActionType.Chest]: OPEN_CRATE,
  [ActionType.Help]: `${TRANSFER} troops`,
  [ActionType.SpireTravel]: "Travel through the spire",
  [ActionType.EnterDepth]: "Enter a depth",
  [ActionType.UseSite]: USE,
};

const orderOf = ({ path, exploreStamina, food, site }: TileOrder): OrderTip | null => {
  const actionType = path && path.length >= 2 ? ActionPaths.getActionType(path) : undefined;
  const line = actionType === undefined ? undefined : ORDERS[actionType];
  if (!path || line === undefined) return null;
  // A crate costs nothing; a depth's entry depends on the depth, which the spire's card picks with its cost.
  if (actionType === ActionType.Chest || actionType === ActionType.EnterDepth) return { line, cost: null };
  if (actionType === ActionType.UseSite)
    return { line, cost: site ? siteGainLine(site.kind, site.gain, site.stamina) : null };
  const stamina = computeEffectiveStaminaCost(path.slice(1), actionType, exploreStamina);
  const pieces = [
    ...(stamina > 0 ? [`${formatCharge(stamina)} ${STAMINA}`] : []),
    ...(food.wheat > 0 ? [`${formatCharge(food.wheat)} wheat`] : []),
    ...(food.fish > 0 ? [`${formatCharge(food.fish)} fish`] : []),
  ];
  return { line, cost: pieces.length > 0 ? pieces.join(" · ") : null };
};

/**
 * The order a tile the planner refused would take, by what it holds: an attack on a target, a crate's opening, else a
 * move onto revealed land or an explore into the fog.
 */
export const refusedOrderVerb = ({
  holds,
  explored,
}: {
  holds: "target" | "crate" | null;
  explored: boolean;
}): string => {
  if (holds === "target") return ATTACK;
  if (holds === "crate") return OPEN_CRATE;
  return explored ? MOVE : EXPLORE;
};

/**
 * Why no order leads here, as the planner recorded it; a fogged tile it said nothing of is only unexplored, and a
 * revealed one it said nothing of has nothing to say.
 */
const refusalLine = ({ refusal, staminaWait, staminaHeld, explored }: TileOrder): string | null => {
  if (refusal?.reason === "stamina") return staminaShortfall(staminaHeld, refusal.need, staminaWait);
  if (refusal) return REFUSALS[refusal.reason];
  return explored ? null : UNEXPLORED;
};

const REFUSALS: Record<Exclude<OrderRefusal["reason"], "stamina">, string> = {
  food: "Not enough food for the army",
  "off-limits": "Only unclaimed structures can be attacked",
  "no-attack": "This game allows no attack here",
  "no-transfer": "This game allows no transfer here",
  occupied: "No army can enter this tile",
  "too-far": "Too far: move next to it",
};

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
