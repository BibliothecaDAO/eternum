import { create } from "zustand";

/** A hex in the route's coordinates, or none: the entry has no realm to open. */
type EntryDestination = { col: number; row: number } | null;

const useEntryDestinationStore = create<{ destination: EntryDestination | undefined }>(() => ({
  destination: undefined,
}));

/**
 * Where the map first opens when the route names no hex: the realm the entry selects. Herald streams a Frontier realm in
 * the scope of the entry's subject, after the snapshot: the player's own once the account is connected, a spectator's
 * once the season leader's visit applies. The map's first pass fixes the world origin, so it waits for this rather than
 * opening at the origin and reloading on the way to the realm. The first answer of a game stands.
 */
export const settleEntryDestination = (destination: EntryDestination): void => {
  if (useEntryDestinationStore.getState().destination !== undefined) return;
  useEntryDestinationStore.setState({ destination });
};

/** A new game's entry has not answered yet. */
export const resetEntryDestination = (): void => useEntryDestinationStore.setState({ destination: undefined });

export const whenEntryDestinationSettled = (): Promise<EntryDestination> =>
  new Promise((resolve) => {
    const settled = useEntryDestinationStore.getState().destination;
    if (settled !== undefined) return resolve(settled);
    const stop = useEntryDestinationStore.subscribe(({ destination }) => {
      if (destination === undefined) return;
      stop();
      resolve(destination);
    });
  });
