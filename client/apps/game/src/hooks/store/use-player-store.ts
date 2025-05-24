import { PlayerDataStore, PlayerDataTransformed } from "@/three/managers/player-data-store";
import React from "react";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface PlayerStore {
  // State
  playerDataStore: PlayerDataStore | null;
  currentPlayerData: PlayerDataTransformed | null;
  isLoading: boolean;
  lastRefreshTime: number;

  // Actions
  initializePlayerStore: (refreshInterval?: number) => void;
  refreshPlayerData: () => Promise<void>;
  getPlayerDataByAddress: (address: string) => Promise<PlayerDataTransformed | undefined>;
  getPlayerDataByStructureId: (structureId: string) => Promise<PlayerDataTransformed | undefined>;
  getPlayerDataByExplorerId: (explorerId: string) => Promise<PlayerDataTransformed | undefined>;
  getExplorerOwnerAddress: (explorerId: string) => Promise<string>;
  getStructureName: (structureId: string) => Promise<string>;
  getAllPlayersData: () => Promise<PlayerDataTransformed[]>;
  getCurrentPlayerData: (playerAddress: string) => Promise<void>;
  updateStructureOwnerAddress: (structureId: string, ownerAddress: string) => void;
  updateExplorerStructure: (explorerId: string, structureId: string) => void;
  clearPlayerData: () => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Global player data store using Zustand
 *
 * This store provides global access to player data throughout the application.
 * It integrates with the PlayerDataStore singleton and provides a reactive interface
 * for accessing player information including names, guilds, and entity relationships.
 *
 * @example
 * ```tsx
 * // Get current player data
 * const currentPlayerData = useCurrentPlayerData();
 * const isLoading = usePlayerDataLoading();
 *
 * // Use the full store
 * const { getPlayerDataByAddress, refreshPlayerData } = usePlayerStore();
 *
 * // Custom hook with automatic loading
 * const { data: playerData, loading } = usePlayerDataByAddress(playerAddress);
 * ```
 */
export const usePlayerStore = create<PlayerStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    playerDataStore: null,
    currentPlayerData: null,
    isLoading: false,
    lastRefreshTime: 0,

    /**
     * Initialize the player store with PlayerDataStore singleton
     * @param refreshInterval - How often to refresh data in milliseconds (default: 6 hours)
     */
    initializePlayerStore: (refreshInterval = 6 * 60 * 60 * 1000) => {
      const playerDataStore = PlayerDataStore.getInstance(refreshInterval);
      set({ playerDataStore });

      // Initial refresh
      get().refreshPlayerData();
    },

    /**
     * Refresh the underlying PlayerDataStore
     * Call this to force a refresh of all player data from the server
     */
    refreshPlayerData: async () => {
      const { playerDataStore } = get();
      if (!playerDataStore) return;

      set({ isLoading: true });
      try {
        await playerDataStore.refresh();
        set({ lastRefreshTime: Date.now() });
      } catch (error) {
        console.error("Failed to refresh player data:", error);
      } finally {
        set({ isLoading: false });
      }
    },

    /**
     * Get player data by wallet address
     * @param address - The wallet address (as string)
     * @returns Player data or undefined if not found
     */
    getPlayerDataByAddress: async (address: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return undefined;
      return await playerDataStore.getPlayerDataFromAddress(address);
    },

    /**
     * Get player data by structure ID
     * @param structureId - The structure entity ID
     * @returns Player data or undefined if not found
     */
    getPlayerDataByStructureId: async (structureId: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return undefined;
      return await playerDataStore.getPlayerDataFromStructureId(structureId);
    },

    /**
     * Get player data by explorer ID
     * @param explorerId - The explorer entity ID
     * @returns Player data or undefined if not found
     */
    getPlayerDataByExplorerId: async (explorerId: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return undefined;
      return await playerDataStore.getPlayerDataFromExplorerId(explorerId);
    },

    /**
     * Get explorer owner address
     * @param explorerId - The explorer entity ID
     * @returns Owner address or empty string if not found
     */
    getExplorerOwnerAddress: async (explorerId: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return "";
      return await playerDataStore.getExplorerOwnerAddress(explorerId);
    },

    getStructureName: async (structureId: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return "";
      return await playerDataStore.getStructureName(structureId);
    },

    /**
     * Get and cache current player data
     * This updates the currentPlayerData state for easy access
     * @param playerAddress - The current player's wallet address
     */
    getCurrentPlayerData: async (playerAddress: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return;

      set({ isLoading: true });
      try {
        const currentPlayerData = await playerDataStore.getPlayerDataFromAddress(playerAddress);
        set({ currentPlayerData });
      } catch (error) {
        console.error("Failed to get current player data:", error);
      } finally {
        set({ isLoading: false });
      }
    },

    /**
     * Update structure owner address
     * Use this when you know a structure's owner has changed
     * @param structureId - The structure entity ID
     * @param ownerAddress - The new owner's address
     */
    updateStructureOwnerAddress: (structureId: string, ownerAddress: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return;
      playerDataStore.updateStructureOwnerAddress(structureId, ownerAddress);
    },

    /**
     * Update explorer structure mapping
     * Use this when you know an explorer's associated structure
     * @param explorerId - The explorer entity ID
     * @param structureId - The associated structure ID
     */
    updateExplorerStructure: (explorerId: string, structureId: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return;
      playerDataStore.updateExplorerStructure(explorerId, structureId);
    },

    /**
     * Clear all player data
     * Use this for logout or when you need to reset the cache
     */
    clearPlayerData: () => {
      const { playerDataStore } = get();
      if (playerDataStore) {
        playerDataStore.clear();
      }
      set({
        currentPlayerData: null,
        lastRefreshTime: 0,
      });
    },

    /**
     * Set loading state
     * @param loading - The loading state
     */
    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    getAllPlayersData: async () => {
      const { playerDataStore } = get();
      if (!playerDataStore) return [];
      return await playerDataStore.getAllPlayersData();
    },
  })),
);

// Convenience hooks for common use cases

/**
 * Hook to get the current player's data
 * @returns Current player data or null
 */
export const useCurrentPlayerData = () => usePlayerStore((state) => state.currentPlayerData);

/**
 * Hook to get the loading state
 * @returns Boolean indicating if player data is loading
 */
export const usePlayerDataLoading = () => usePlayerStore((state) => state.isLoading);

/**
 * Hook to get player data by address with automatic loading state
 * @param address - The wallet address to lookup
 * @returns Object with data and loading state
 */
export const usePlayerDataByAddress = (address: string | null) => {
  const getPlayerDataByAddress = usePlayerStore((state) => state.getPlayerDataByAddress);
  const [data, setData] = React.useState<PlayerDataTransformed | undefined>(undefined);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!address) {
      setData(undefined);
      return;
    }

    setLoading(true);
    getPlayerDataByAddress(address)
      .then(setData)
      .finally(() => setLoading(false));
  }, [address, getPlayerDataByAddress]);

  return { data, loading };
};

/**
 * Hook to get player data by structure ID with automatic loading state
 * @param structureId - The structure ID to lookup
 * @returns Object with data and loading state
 */
export const usePlayerDataByStructureId = (structureId: string | null) => {
  const getPlayerDataByStructureId = usePlayerStore((state) => state.getPlayerDataByStructureId);
  const [data, setData] = React.useState<PlayerDataTransformed | undefined>(undefined);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!structureId) {
      setData(undefined);
      return;
    }

    setLoading(true);
    getPlayerDataByStructureId(structureId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [structureId, getPlayerDataByStructureId]);

  return { data, loading };
};

/**
 * Hook to get player data by explorer ID with automatic loading state
 * @param explorerId - The explorer ID to lookup
 * @returns Object with data and loading state
 */
export const usePlayerDataByExplorerId = (explorerId: string | null) => {
  const getPlayerDataByExplorerId = usePlayerStore((state) => state.getPlayerDataByExplorerId);
  const [data, setData] = React.useState<PlayerDataTransformed | undefined>(undefined);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!explorerId) {
      setData(undefined);
      return;
    }

    setLoading(true);
    getPlayerDataByExplorerId(explorerId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [explorerId, getPlayerDataByExplorerId]);

  return { data, loading };
};
