import { type SentCommand, untilApplied } from "@/sync/action-outcome";
import { create } from "zustand";

/** The order an army has in flight: sent from this screen, its outcome not known yet. */
export type OrderInFlight = "explore" | "move" | "attack" | "use";

/**
 * The acting surfaces' own state for the orders they sent: which of the player's armies has one in flight. An army
 * takes one order at a time, so until that order's own outcome arrives (applied, or refused with its reason) the map
 * offers the army no other and its controls cannot be pressed again. It is never a game fact.
 */
const useOrdersInFlight = create<{ byArmy: ReadonlyMap<number, OrderInFlight> }>(() => ({ byArmy: new Map() }));

export const useArmyOrderInFlight = (armyId: number | null): OrderInFlight | undefined =>
  useOrdersInFlight((state) => (armyId === null ? undefined : state.byArmy.get(armyId)));

export const armyOrderInFlight = (armyId: number): OrderInFlight | undefined =>
  useOrdersInFlight.getState().byArmy.get(armyId);

/**
 * Gives an army its order, the one way any surface does: one order of an army at a time, held in flight until the
 * action's own outcome. Resolves true once the game has applied it, and false without sending anything when the army
 * already has an order in flight, so a second press on the same control, or another surface's order for the same
 * army, never becomes a second transaction. Rejects with the reason when the order was refused or could not be sent;
 * either way the army takes orders again.
 */
export const orderArmy = async (
  armyId: number,
  order: OrderInFlight,
  send: () => Promise<SentCommand>,
): Promise<boolean> => {
  if (!takeArmy(armyId, order)) return false;
  try {
    await untilApplied(send());
    return true;
  } finally {
    freeArmy(armyId);
  }
};

const takeArmy = (armyId: number, order: OrderInFlight): boolean => {
  const { byArmy } = useOrdersInFlight.getState();
  if (byArmy.has(armyId)) return false;
  useOrdersInFlight.setState({ byArmy: new Map(byArmy).set(armyId, order) });
  return true;
};

const freeArmy = (armyId: number): void => {
  const byArmy = new Map(useOrdersInFlight.getState().byArmy);
  if (byArmy.delete(armyId)) useOrdersInFlight.setState({ byArmy });
};
