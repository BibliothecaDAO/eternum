import { BattleLogEvent, fetchBattleLogs } from "@/services/api";
import { ResourcesIds } from "@bibliothecadao/types";
import React from "react";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface ParsedReward {
  resourceId: ResourcesIds;
  amount: string;
}

export interface ProcessedBattleLogEvent extends BattleLogEvent {
  id: string; // Unique identifier for React keys
  timestampMs: number; // Parsed timestamp in milliseconds
  parsedRewards: ParsedReward[]; // Parsed max_reward for easy rendering
  isRaidEvent: boolean; // Helper to distinguish event types
  isWin: boolean; // Helper to determine if battle was won
}

interface BattleLogsStore {
  // State
  battleLogs: ProcessedBattleLogEvent[];
  isLoading: boolean;
  lastFetchTimestamp: string | null;
  error: string | null;

  // Actions
  fetchInitialBattleLogs: () => Promise<void>;
  fetchNewBattleLogs: () => Promise<void>;
  refreshBattleLogs: () => Promise<void>;
  clearBattleLogs: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Parses max_reward string into structured reward data
 */
const parseMaxReward = (maxReward: string | number): ParsedReward[] => {
  if (typeof maxReward === "number" || !maxReward || maxReward === "[]") {
    return [];
  }

  try {
    const parsed = JSON.parse(maxReward);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(([resourceId, amount]: [number, string]) => ({
      resourceId: resourceId as ResourcesIds,
      amount,
    }));
  } catch (error) {
    console.warn("Failed to parse max_reward:", maxReward, error);
    return [];
  }
};

/**
 * Converts hex timestamp to milliseconds
 */
const parseTimestamp = (hexTimestamp: string): number => {
  try {
    const bigIntValue = BigInt(hexTimestamp);
    // Convert to milliseconds (assuming timestamp is in seconds)
    return Number(bigIntValue) * 1000;
  } catch (error) {
    console.warn("Failed to parse timestamp:", hexTimestamp, error);
    return Date.now();
  }
};

/**
 * Processes raw battle log event into a more usable format
 */
const processBattleLogEvent = (event: BattleLogEvent): ProcessedBattleLogEvent => {
  const timestampMs = parseTimestamp(event.timestamp);
  const isRaidEvent = event.event_type === "ExplorerNewRaidEvent";

  let isWin = false;
  if (isRaidEvent) {
    isWin = event.success === 1;
  } else {
    // For battle events, check if attacker_owner_id matches winner_id
    isWin = event.attacker_owner_id === event.winner_id;
  }

  return {
    ...event,
    id: `${event.event_type}-${event.attacker_id}-${event.defender_id}-${event.timestamp}`,
    timestampMs,
    parsedRewards: parseMaxReward(event.max_reward),
    isRaidEvent,
    isWin,
  };
};

/**
 * Global battle logs store using Zustand
 *
 * This store manages battle and raid event data, providing real-time updates
 * and efficient incremental loading based on timestamps.
 *
 * @example
 * ```tsx
 * const { battleLogs, isLoading, fetchInitialBattleLogs } = useBattleLogsStore();
 * const battleLogsLoading = useBattleLogsLoading();
 * const latestBattleLogs = useLatestBattleLogs(10);
 * ```
 */
export const useBattleLogsStore = create<BattleLogsStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    battleLogs: [],
    isLoading: true,
    lastFetchTimestamp: null,
    error: null,

    /**
     * Fetch initial battle logs (full load)
     * This should be called on first load or when clearing cache
     */
    fetchInitialBattleLogs: async () => {
      set({ isLoading: true, error: null });
      try {
        const rawLogs = await fetchBattleLogs();
        const processedLogs = rawLogs.map(processBattleLogEvent);
        // Sort by timestamp (most recent first)
        processedLogs.sort((a, b) => b.timestampMs - a.timestampMs);

        const lastTimestamp = processedLogs.length > 0 ? processedLogs[0].timestamp : null;

        set({
          battleLogs: processedLogs,
          lastFetchTimestamp: lastTimestamp,
        });
      } catch (error) {
        console.error("Failed to fetch initial battle logs:", error);
        set({ error: error instanceof Error ? error.message : "Failed to fetch battle logs" });
      } finally {
        set({ isLoading: false });
      }
    },

    /**
     * Fetch new battle logs since last fetch
     * This is used for incremental updates
     */
    fetchNewBattleLogs: async () => {
      const { isLoading, lastFetchTimestamp, battleLogs } = get();
      if (isLoading) return;

      set({ isLoading: true, error: null });
      try {
        const rawLogs = await fetchBattleLogs(lastFetchTimestamp || undefined);
        if (rawLogs.length === 0) {
          set({ isLoading: false });
          return;
        }

        const processedLogs = rawLogs.map(processBattleLogEvent);
        // Merge with existing logs, avoiding duplicates
        const existingIds = new Set(battleLogs.map((log) => log.id));
        const newLogs = processedLogs.filter((log) => !existingIds.has(log.id));

        const allLogs = [...newLogs, ...battleLogs];

        // Sort by timestamp (most recent first) and limit to prevent memory issues
        allLogs.sort((a, b) => b.timestampMs - a.timestampMs);
        const limitedLogs = allLogs;
        const newLastTimestamp = limitedLogs.length > 0 ? limitedLogs[0].timestamp : lastFetchTimestamp;

        set({
          battleLogs: limitedLogs,
          lastFetchTimestamp: newLastTimestamp,
        });
      } catch (error) {
        console.error("Failed to fetch new battle logs:", error);
        set({ error: error instanceof Error ? error.message : "Failed to fetch new battle logs" });
      } finally {
        set({ isLoading: false });
      }
    },

    /**
     * Force refresh all battle logs
     * This clears cache and fetches everything fresh
     */
    refreshBattleLogs: async () => {
      // Keep existing logs during refresh, rely on isLoading state
      // set({
      //   battleLogs: [],
      //   lastFetchTimestamp: null,
      //   error: null
      // });
      set({ lastFetchTimestamp: null, error: null }); // Clear timestamp and error, but keep logs
      await get().fetchInitialBattleLogs();
    },

    /**
     * Clear all battle logs data
     */
    clearBattleLogs: () => {
      set({
        battleLogs: [],
        lastFetchTimestamp: null,
        error: null,
        isLoading: false,
      });
    },

    /**
     * Set loading state
     */
    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    /**
     * Set error state
     */
    setError: (error: string | null) => {
      set({ error });
    },
  })),
);

// Convenience hooks for common use cases

/**
 * Hook to get all battle logs
 */
export const useBattleLogs = () => useBattleLogsStore((state) => state.battleLogs);

/**
 * Hook to get loading state
 */
export const useBattleLogsLoading = () => useBattleLogsStore((state) => state.isLoading);

/**
 * Hook to get error state
 */
export const useBattleLogsError = () => useBattleLogsStore((state) => state.error);

/**
 * Hook to get the latest N battle logs
 */
export const useLatestBattleLogs = (limit: number = 50) => {
  const battleLogs = useBattleLogsStore((state) => state.battleLogs);
  return React.useMemo(() => battleLogs.slice(0, limit), [battleLogs, limit]);
};

/**
 * Hook to get battle logs filtered by a specific player
 */
export const useBattleLogsByPlayer = (playerOwnerId: number | null) => {
  const battleLogs = useBattleLogsStore((state) => state.battleLogs);
  return React.useMemo(() => {
    if (!playerOwnerId) return [];
    return battleLogs.filter(
      (log) => log.attacker_owner_id === playerOwnerId || log.defender_owner_id === playerOwnerId,
    );
  }, [battleLogs, playerOwnerId]);
};
