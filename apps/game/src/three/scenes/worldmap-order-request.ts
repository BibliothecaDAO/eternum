import { type ActionPath, ActionPaths, ActionType } from "@bibliothecadao/eternum";

/**
 * The HUD's verb for the order the player has pinned: a tap on a tile the selected army can explore or move to pins
 * it (the path and its costs show), and the verb asks the world map to run that order. A right-click, or a
 * press-and-hold on a touch screen, runs it at once without the preview.
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

/** An order that takes the army to a tile: one it can explore or move to, at least a step away. */
export const pinsOrder = (path: ActionPath[] | undefined): boolean => {
  if (!path || path.length < 2) return false;
  const actionType = ActionPaths.getActionType(path);
  return actionType === ActionType.Explore || actionType === ActionType.Move;
};

/**
 * What a tap on a tile means for the selected army, the same tap for every order: a tile it can explore or move to
 * pins that order (the HUD shows its costs and its verb), a target in its reach opens the attack's preview with its
 * confirm, and a standing site out of its reach still opens that site's card for this army, which says what it lacks.
 * Anything else keeps its own tap.
 */
type TapOrder = "pin" | "attack" | "site-out-of-reach";

export const orderOnTap = ({
  path,
  armySelected,
  standingSite,
}: {
  path: ActionPath[] | undefined;
  armySelected: boolean;
  standingSite: boolean;
}): TapOrder | null => {
  if (pinsOrder(path)) return "pin";
  if (path && ActionPaths.getActionType(path) === ActionType.Attack) return "attack";
  return armySelected && standingSite ? "site-out-of-reach" : null;
};

/**
 * Escape backs out one step. Where the HUD carries the order's verb, the pinned order goes first and the selection
 * second. Where it does not, an open navigation view closes before the selection clears.
 */
export const stepBackOnEscape = ({
  hudCarriesOrderVerb,
  orderPinned,
  navigationViewOpen,
}: {
  hudCarriesOrderVerb: boolean;
  orderPinned: boolean;
  navigationViewOpen: boolean;
}): "cancel-order" | "close-view" | "clear-selection" => {
  if (hudCarriesOrderVerb) return orderPinned ? "cancel-order" : "clear-selection";
  return navigationViewOpen ? "close-view" : "clear-selection";
};

/**
 * Whether the HUD carries the order's verb: Frontier's on a phone, which has no pointer to hover. There a tap names the
 * order's tile and the HUD confirms it. Elsewhere (Blitz, and Frontier on a desktop: the owner, 19 October 2026, "I
 * dont see on desktop why it wouldnt be contextual the explore") the order under the pointer is the preview.
 */
export const orderVerbOnHud = ({ frontier, layout }: { frontier: boolean; layout: "phone" | "desktop" }): boolean =>
  frontier && layout === "phone";

/**
 * Whether an attack is confirmed on the target's tile card, the HUD's sheet for the selected tile, rather than the
 * attack preview. A standing expedition site always is. In Frontier, on every layout, so is an army's attack on another
 * army: one surface for whatever an army attacks. A realm's own guard attacking still opens the preview.
 */
export const attackConfirmsOnTileCard = ({
  frontier,
  standingSite,
  attackerIsArmy,
  targetIsArmy,
}: {
  frontier: boolean;
  standingSite: boolean;
  attackerIsArmy: boolean;
  targetIsArmy: boolean;
}): boolean => standingSite || (frontier && attackerIsArmy && targetIsArmy);
