import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useAccountStore } from "@/hooks/store/use-account-store";
import type { EventsFilter } from "@/ui/features/event-feed/event-stories";

/** What a player has not chosen yet: the important events. */
const DEFAULT_FILTER: EventsFilter = "important";

interface EventsFilterState {
  /** Each player's choice, by their address on this device. */
  byPlayer: Record<string, EventsFilter>;
  choose: (player: string, filter: EventsFilter) => void;
}

/** A choice saved before Mine was cut (26 October): everything Mine showed is in All. */
const keptChoices = (persisted: unknown): Record<string, EventsFilter> => {
  const byPlayer = (persisted as { byPlayer?: Record<string, string> } | null)?.byPlayer ?? {};
  return Object.fromEntries(
    Object.entries(byPlayer).map(([player, filter]) => [player, filter === "important" ? "important" : "all"]),
  );
};

/** The lens Events and the Log show, remembered for each player who chose one on this device. */
const useEventsFilterStore = create<EventsFilterState>()(
  persist(
    (set) => ({
      byPlayer: {},
      choose: (player, filter) => set((state) => ({ byPlayer: { ...state.byPlayer, [player]: filter } })),
    }),
    {
      name: "eternum-events-filter",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ byPlayer }) => ({ byPlayer }),
      migrate: (persisted) => ({ byPlayer: keptChoices(persisted) }) as EventsFilterState,
    },
  ),
);

/** The signed-in player's lens for Events and the Log, and how to change it; a spectator's is kept as anyone's. */
export const useEventsFilter = (): [EventsFilter, (filter: EventsFilter) => void] => {
  const player = playerKey(useAccountStore((state) => state.account?.address ?? null));
  const chosen = useEventsFilterStore((state) => state.byPlayer[player] ?? DEFAULT_FILTER);
  const choose = useEventsFilterStore((state) => state.choose);
  return [chosen, (next) => choose(player, next)];
};

/** A player's key, the same however their address is written; one key for a viewer with no account. */
const playerKey = (address: string | null): string =>
  address === null ? "anyone" : `0x${BigInt(address).toString(16)}`;
