import { create } from "zustand";

import {
  fetchLandingLeaderboard,
  fetchLandingLeaderboardEntryByAddress,
  type LandingLeaderboardEntry,
} from "./landing-leaderboard-service";

type PlayerEntryState = {
  data: LandingLeaderboardEntry | null;
  isFetching: boolean;
  error: string | null;
  lastFetchedAt: number | null;
};

type FetchLeaderboardOptions = {
  force?: boolean;
  limit?: number;
};

type FetchPlayerEntryOptions = {
  force?: boolean;
};

export const MIN_REFRESH_INTERVAL_MS = 10_000;

type LandingLeaderboardStore = {
  entries: LandingLeaderboardEntry[];
  lastUpdatedAt: number | null;
  lastFetchAt: number | null;
  isFetching: boolean;
  error: string | null;
  championEntry: LandingLeaderboardEntry | null;
  playerEntries: Record<string, PlayerEntryState>;
  fetchLeaderboard: (options?: FetchLeaderboardOptions) => Promise<void>;
  fetchPlayerEntry: (address: string, options?: FetchPlayerEntryOptions) => Promise<LandingLeaderboardEntry | null>;
  reset: () => void;
};

const buildPlayerEntryState = (partial?: Partial<PlayerEntryState>): PlayerEntryState => ({
  data: null,
  isFetching: false,
  error: null,
  lastFetchedAt: null,
  ...partial,
});

const normalizeAddress = (address: string): string => address.trim().toLowerCase();

export const useLandingLeaderboardStore = create<LandingLeaderboardStore>((set, get) => ({
  entries: [],
  lastUpdatedAt: null,
  lastFetchAt: null,
  isFetching: false,
  error: null,
  championEntry: null,
  playerEntries: {},
  fetchLeaderboard: async ({ force = false, limit = 25 }: FetchLeaderboardOptions = {}) => {
    const state = get();
    const now = Date.now();

    if (state.isFetching) {
      return;
    }

    if (!force && state.lastFetchAt && now - state.lastFetchAt < MIN_REFRESH_INTERVAL_MS) {
      return;
    }

    if (!force && state.entries.length > 0 && state.lastUpdatedAt && now - state.lastUpdatedAt < MIN_REFRESH_INTERVAL_MS) {
      return;
    }

    set((previous) => ({
      isFetching: true,
      error: force ? null : previous.error,
      lastFetchAt: now,
    }));

    try {
      const fetchedEntries = await fetchLandingLeaderboard(limit, 0);

      let champion = fetchedEntries[0] ?? null;
      let enrichedEntries = fetchedEntries;

      if (champion && !champion.displayName?.trim()) {
        try {
          const detailedChampion = await fetchLandingLeaderboardEntryByAddress(champion.address);
          if (detailedChampion?.displayName?.trim()) {
            champion = { ...detailedChampion, rank: champion.rank };
            enrichedEntries = [champion, ...fetchedEntries.slice(1)];
          }
        } catch (lookupError) {
          console.error("Failed to resolve champion display name", lookupError);
        }
      }

      const championKey = champion ? normalizeAddress(champion.address) : null;
      const timestamp = Date.now();

      set((previous) => ({
        entries: enrichedEntries,
        lastUpdatedAt: timestamp,
        lastFetchAt: timestamp,
        isFetching: false,
        error: null,
        championEntry: champion ?? previous.championEntry,
        playerEntries:
          championKey != null
            ? {
                ...previous.playerEntries,
                [championKey]: buildPlayerEntryState({
                  data: champion,
                  isFetching: false,
                  error: null,
                  lastFetchedAt: timestamp,
                }),
              }
            : previous.playerEntries,
      }));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to load leaderboard.";
      const now = Date.now();
      set({
        isFetching: false,
        error: message,
        lastFetchAt: now,
      });
    }
  },
  fetchPlayerEntry: async (address: string, { force = false }: FetchPlayerEntryOptions = {}) => {
    if (!address) {
      return null;
    }

    const normalized = normalizeAddress(address);
    const state = get();
    const existing = state.playerEntries[normalized];
    const now = Date.now();

    if (!force && existing?.lastFetchedAt && now - existing.lastFetchedAt < MIN_REFRESH_INTERVAL_MS) {
      return existing.data ?? null;
    }

    if (existing?.isFetching) {
      return existing.data ?? null;
    }

    set((previous) => ({
      playerEntries: {
        ...previous.playerEntries,
        [normalized]: buildPlayerEntryState({
          data: existing?.data ?? null,
          isFetching: true,
          error: null,
          lastFetchedAt: now,
        }),
      },
      lastFetchAt: now,
    }));

    try {
      const entry = await fetchLandingLeaderboardEntryByAddress(address);
      const timestamp = Date.now();

      set((previous) => {
        const updatedEntries = entry
          ? previous.entries.map((current) =>
              normalizeAddress(current.address) === normalized ? { ...current, ...entry } : current,
            )
          : previous.entries;

        const updatedChampion =
          previous.championEntry && normalizeAddress(previous.championEntry.address) === normalized
            ? { ...previous.championEntry, ...entry }
            : previous.championEntry;

        return {
          entries: updatedEntries,
          championEntry: updatedChampion,
          lastFetchAt: timestamp,
          playerEntries: {
            ...previous.playerEntries,
            [normalized]: buildPlayerEntryState({
              data: entry ?? null,
              isFetching: false,
              error: null,
              lastFetchedAt: timestamp,
            }),
          },
        };
      });

      return entry ?? null;
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to load player standings.";
      const fallbackData = existing?.data ?? null;
      const timestamp = Date.now();

      set((previous) => ({
        lastFetchAt: timestamp,
        playerEntries: {
          ...previous.playerEntries,
          [normalized]: buildPlayerEntryState({
            data: fallbackData,
            isFetching: false,
            error: message,
            lastFetchedAt: timestamp,
          }),
        },
      }));

      return fallbackData;
    }
  },
  reset: () =>
    set({
      entries: [],
      lastUpdatedAt: null,
      lastFetchAt: null,
      isFetching: false,
      error: null,
      championEntry: null,
      playerEntries: {},
    }),
}));
