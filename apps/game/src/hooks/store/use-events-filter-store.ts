import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useIsWatching } from "@/utils/can-issue-orders";
import type { EventsFilter } from "@/ui/features/event-feed/event-stories";

/** What a player has not chosen yet: the important events. */
const DEFAULT_FILTER: EventsFilter = "important";

interface EventsFilterState {
  /** Each player's choice, by their address on this device. */
  byPlayer: Record<string, EventsFilter>;
  choose: (player: string, filter: EventsFilter) => void;
}

/** The filter Events and the Log show, remembered for each player who chose one on this device. */
const useEventsFilterStore = create<EventsFilterState>()(
  persist(
    (set) => ({
      byPlayer: {},
      choose: (player, filter) => set((state) => ({ byPlayer: { ...state.byPlayer, [player]: filter } })),
    }),
    {
      name: "eternum-events-filter",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ byPlayer }) => ({ byPlayer }),
    },
  ),
);

/**
 * The signed-in player's filter for Events and the Log, and how to change it; a spectator's is kept as anyone's. A
 * spectator has nothing of their own to show, so Mine reads as All while they watch.
 */
export const useEventsFilter = (): [EventsFilter, (filter: EventsFilter) => void] => {
  const player = playerKey(useAccountStore((state) => state.account?.address ?? null));
  const chosen = useEventsFilterStore((state) => state.byPlayer[player] ?? DEFAULT_FILTER);
  const watching = useIsWatching();
  const choose = useEventsFilterStore((state) => state.choose);
  return [watching && chosen === "mine" ? "all" : chosen, (next) => choose(player, next)];
};

/** A player's key, the same however their address is written; one key for a viewer with no account. */
const playerKey = (address: string | null): string =>
  address === null ? "anyone" : `0x${BigInt(address).toString(16)}`;
