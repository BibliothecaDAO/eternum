import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { SqlApi } from "../../../torii/src/queries/sql/api";
import { PlayerDataStore, PlayerDataTransformed } from "./player-data-store";

interface PlayerStore {
  playerDataStore: PlayerDataStore | null;
  currentPlayerData: PlayerDataTransformed | null;
  isLoading: boolean;
  lastRefreshTime: number;

  initializePlayerStore: (sqlApi: SqlApi, refreshInterval?: number) => void;
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

export const usePlayerStore = create<PlayerStore>()(
  subscribeWithSelector((set, get) => ({
    playerDataStore: null,
    currentPlayerData: null,
    isLoading: false,
    lastRefreshTime: 0,

    initializePlayerStore: (sqlApi: SqlApi, refreshInterval = 6 * 60 * 60 * 1000) => {
      const playerDataStore = PlayerDataStore.getInstance(refreshInterval, sqlApi);
      set({ playerDataStore });

      get().refreshPlayerData();
    },

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

    getPlayerDataByAddress: async (address: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return undefined;
      return await playerDataStore.getPlayerDataFromAddress(address);
    },

    getPlayerDataByStructureId: async (structureId: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return undefined;
      return await playerDataStore.getPlayerDataFromStructureId(structureId);
    },

    getPlayerDataByExplorerId: async (explorerId: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return undefined;
      return await playerDataStore.getPlayerDataFromExplorerId(explorerId);
    },

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

    updateStructureOwnerAddress: (structureId: string, ownerAddress: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return;
      playerDataStore.updateStructureOwnerAddress(structureId, ownerAddress);
    },

    updateExplorerStructure: (explorerId: string, structureId: string) => {
      const { playerDataStore } = get();
      if (!playerDataStore) return;
      playerDataStore.updateExplorerStructure(explorerId, structureId);
    },

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
