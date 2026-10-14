import { useUIStore } from "@/hooks/store/use-ui-store";
import type { NextOrder } from "@/hooks/store/use-three-store";
import { recordArmyMovementLatencyPhase } from "@bibliothecadao/eternum";
import type { HexPosition, ID } from "@bibliothecadao/types";

/** Why a next order left without running. */
type DropReason = "replaced" | "cancelled" | "refused" | "out-of-reach" | "not-selected";

/**
 * An army's next order: the tile the player tapped for it while its last order was still in flight. It is the acting
 * surface's own click feedback, never a game fact. There is one at a time: a later tap replaces it. It leaves at the
 * in-flight order's outcome (it runs from where the army then stands, or is dropped when that order was refused) or at
 * Cancel. Each step is in the army trace, so a tap that never became an order is never silent.
 */
export const queueNextOrder = (entityId: ID, hex: HexPosition): void => {
  const queued = currentNextOrder();
  if (queued) traceDrop(queued, "replaced");
  setNextOrder({ entityId, hex });
  trace("next_order_queued", entityId, { col: hex.col, row: hex.row });
};

/** The army's next order, taken off the queue to run now; null when it has none. */
export const takeNextOrder = (entityId: ID): HexPosition | null => {
  const queued = currentNextOrder();
  if (queued?.entityId !== entityId) return null;
  setNextOrder(null);
  trace("next_order_run", entityId, { col: queued.hex.col, row: queued.hex.row });
  return queued.hex;
};

/** Drops the next order, of one army or whichever is queued, for the reason given. */
export const dropNextOrder = (reason: DropReason, entityId?: ID): void => {
  const queued = currentNextOrder();
  if (!queued || (entityId !== undefined && queued.entityId !== entityId)) return;
  setNextOrder(null);
  traceDrop(queued, reason);
};

const currentNextOrder = (): NextOrder | null => useUIStore.getState().entityActions.nextOrder;

const setNextOrder = (nextOrder: NextOrder | null): void =>
  useUIStore.getState().updateEntityActionNextOrder(nextOrder);

const traceDrop = (queued: NextOrder, reason: DropReason): void =>
  trace("next_order_dropped", queued.entityId, { col: queued.hex.col, row: queued.hex.row, reason });

const trace = (
  phase: "next_order_queued" | "next_order_run" | "next_order_dropped",
  entityId: ID,
  details: Record<string, unknown>,
): void => recordArmyMovementLatencyPhase({ phase, source: "worldmap", entityId, details });
