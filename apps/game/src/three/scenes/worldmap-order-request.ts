import { type ActionPath, ActionPaths, ActionType } from "@bibliothecadao/eternum";

/**
 * The HUD's verb for the order the player has pinned: a tap on a tile the selected army can explore or move to pins
 * it (the path and its costs show), and the verb asks the world map to run that order, as a right-click would.
 */
export const ORDER_REQUEST_EVENT = "orderAtTileRequest";

type Tile = { col: number; row: number };

export const requestOrderAt = (tile: Tile): void => {
  window.dispatchEvent(new CustomEvent(ORDER_REQUEST_EVENT, { detail: tile }));
};

export const readOrderRequest = (event: Event): Tile | null => {
  const detail = (event as CustomEvent<Partial<Tile>>).detail;
  return typeof detail?.col === "number" && typeof detail?.row === "number"
    ? { col: detail.col, row: detail.row }
    : null;
};

/** A tap pins an order only on a tile the army can explore or move to; anything else keeps its own tap. */
export const pinsOrder = (path: ActionPath[] | undefined): boolean => {
  if (!path || path.length < 2) return false;
  const actionType = ActionPaths.getActionType(path);
  return actionType === ActionType.Explore || actionType === ActionType.Move;
};
