import { create } from "zustand";
import { fetchLeaderboard, fetchLeaderboardEntryByAddress, type LeaderboardEntry } from "./leaderboard-service";

interface PlayerEntryState {
  data: LeaderboardEntry | null;
  isFetching: boolean;
  error: string | null;
  lastFetchedAt: number | null;
}

interface FetchLeaderboardOptions {
  force?: boolean;
  limit?: number;
}

interface FetchPlayerEntryOptions {
  force?: boolean;
}

export const MIN_REFRESH_INTERVAL_MS = 10_000;

interface LeaderboardStore {
  entries: LeaderboardEntry[];
  lastUpdatedAt: number | null;
  lastFetchAt: number | null;
  isFetching: boolean;
  error: string | null;
  championEntry: LeaderboardEntry | null;
  playerEntries: Record<string, PlayerEntryState>;
  fetchLeaderboard: (options?: FetchLeaderboardOptions) => Promise<void>;
  fetchPlayerEntry: (address: string, options?: FetchPlayerEntryOptions) => Promise<LeaderboardEntry | null>;
  reset: () => void;
}

const buildPlayerEntryState = (partial?: Partial<PlayerEntryState>): PlayerEntryState => ({
  data: null,
  isFetching: false,
  error: null,
  lastFetchedAt: null,
  ...partial,
});

const normalizeAddress = (address: string): string => address.trim().toLowerCase();

export const useLeaderboardStore = create<LeaderboardStore>((set, get) => ({
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

    if (state.isFetching) return;

    if (!force && state.lastFetchAt && now - state.lastFetchAt < MIN_REFRESH_INTERVAL_MS) return;

    if (
      !force &&
      state.entries.length > 0 &&
      state.lastUpdatedAt &&
      now - state.lastUpdatedAt < MIN_REFRESH_INTERVAL_MS
    )
      return;

    set((previous) => ({
      isFetching: true,
      error: force ? null : previous.error,
      lastFetchAt: now,
    }));

    try {
      const fetchedEntries = await fetchLeaderboard(limit, 0);
      const champion = fetchedEntries[0] ?? null;
      const timestamp = Date.now();
      const championKey = champion ? normalizeAddress(champion.address) : null;

      set((previous) => ({
        entries: fetchedEntries,
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
      const timestamp = Date.now();
      set({
        isFetching: false,
        error: message,
        lastFetchAt: timestamp,
      });
    }
  },
  fetchPlayerEntry: async (address: string, { force = false }: FetchPlayerEntryOptions = {}) => {
    if (!address) return null;

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
      const entry = await fetchLeaderboardEntryByAddress(address);
      const timestamp = Date.now();

      set((previous) => ({
        entries: entry
          ? previous.entries.map((current) =>
              normalizeAddress(current.address) === normalized ? { ...current, ...entry } : current,
            )
          : previous.entries,
        championEntry:
          previous.championEntry && normalizeAddress(previous.championEntry.address) === normalized
            ? { ...previous.championEntry, ...entry }
            : previous.championEntry,
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
      }));

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
