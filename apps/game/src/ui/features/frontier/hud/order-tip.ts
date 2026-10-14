import { computeEffectiveStaminaCost } from "@/lib/army-stamina/path-cost";
import { pinsOrder } from "@/three/scenes/worldmap-order-request";
import { formatExact } from "@/ui/design-system/kit/amount";
import { ARMY, ATTACK, EXPLORE, MOVE, STAMINA, TRANSFER, UNEXPLORED } from "@/ui/design-system/kit/words";
import { type ActionPath, ActionPaths, ActionType } from "@bibliothecadao/eternum";

type TileOrder = {
  path: ActionPath[] | undefined;
  /** What stands on the tile, as its card names it; an army when it is no site. */
  target: string | null;
  exploreStamina: number;
  /** Whether the tile has been revealed; one that has not names itself even where no order leads. */
  explored: boolean;
};

export type OrderTip = {
  /** The order the selected army has on the tile and the stamina it costs. */
  line: string;
  /** Under an explore or a move: the click that looks first and the one that sends at once. */
  gestures: string | null;
};

/**
 * What a tile is, before any click. The map's highlight colours mean the selected army's orders and nothing else; the
 * tooltip is their legend, and where two clicks differ it says which previews and which sends. A tile no order leads
 * to says only that it is unexplored, when it is; a revealed one shows what it is and needs no line.
 */
export const orderTip = (order: TileOrder): OrderTip | null => {
  const line = orderLine(order);
  if (line === null) return order.explored ? null : { line: UNEXPLORED, gestures: null };
  return { line, gestures: pinsOrder(order.path) ? FAST_ORDER_GESTURES : null };
};

const orderLine = ({ path, target, exploreStamina }: Omit<TileOrder, "explored">): string | null => {
  if (!path || path.length < 2) return null;
  const actionType = ActionPaths.getActionType(path);
  const stamina = `${formatExact(computeEffectiveStaminaCost(path.slice(1), actionType, exploreStamina))} ${STAMINA}`;
  if (actionType === ActionType.Explore) return [UNEXPLORED, EXPLORE, stamina].join(SEPARATOR);
  if (actionType === ActionType.Move) return [MOVE, stamina].join(SEPARATOR);
  if (actionType === ActionType.Attack) return [target ?? ARMY, ATTACK, stamina].join(SEPARATOR);
  if (actionType === ActionType.Help) return [target ?? ARMY, TRANSFER].join(SEPARATOR);
  return null;
};

const SEPARATOR = " · ";

/** An attack has no such line: either click opens its forecast, and nothing sends it unseen. */
const FAST_ORDER_GESTURES = ["Click previews", "Right-click sends"].join(SEPARATOR);
