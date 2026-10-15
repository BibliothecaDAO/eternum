import { onOutcome, sendOnce } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { SentCommand } from "@/sync/action-outcome";
import type { ID } from "@bibliothecadao/types";

import { getLiveWorldmapEntityActions } from "./worldmap-interaction-state";

/** A move or an explore: the order that takes the army to a tile (a scene hex). */
interface TravelOrder {
  order: "explore" | "move";
  to: { col: number; row: number };
}

interface TravelOrderOutcome {
  applied(): void;
  refused(error: unknown): void;
}

/**
 * Sends the selected army's move or explore. The army stays selected while the order is in flight and after it, to be
 * ordered again without a second click: at the outcome it is offered its orders from where it then stands
 * (offerSelectedArmyOrdersAtOutcome), and where the order bar shows it, a tap in flight queues its next order.
 */
export const sendSelectedArmyTravel = (
  entityId: ID,
  order: TravelOrder,
  send: () => Promise<SentCommand>,
  outcome: TravelOrderOutcome,
): void => {
  sendOnce("army", entityId, order, send).then(outcome.applied, outcome.refused);
  useUIStore.getState().updateEntityActionHoveredHex(null);
};

/**
 * At an army order's outcome, applied or refused, the army still selected is offered its orders again from where the
 * store now has it. An army the player deselected while its order was in flight is offered nothing.
 */
export const offerSelectedArmyOrdersAtOutcome = (offer: (entityId: ID) => void): (() => void) =>
  onOutcome("army", (key) => {
    const entityId = Number(key);
    if (getLiveWorldmapEntityActions().selectedEntityId === entityId) offer(entityId);
  });
