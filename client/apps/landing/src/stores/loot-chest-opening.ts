import { ChestAsset } from "@/components/modules/chest-content";
import { createStore, StoreApi, useStore } from "zustand";

interface LootChestOpeningStore {
  showLootChestOpening: boolean;
  chestAssets: ChestAsset[];
  openedChestTokenId: string | null;
  setShowLootChestOpening: (show: boolean, assets?: ChestAsset[]) => void;
  setOpenedChestTokenId: (tokenId: string | null) => void;
  clearLootChestOpening: () => void;
}

// Create a map to store different instances of the store
const storeInstances = new Map<string, StoreApi<LootChestOpeningStore>>();

// Factory function to create a store instance
const createLootChestOpeningStore = () =>
  createStore<LootChestOpeningStore>((set, get) => ({
    showLootChestOpening: false,
    chestAssets: [],
    openedChestTokenId: null,

    setShowLootChestOpening: (show: boolean, assets: ChestAsset[] = [], tokenId?: string) => {
      set({
        showLootChestOpening: show,
        chestAssets: show ? assets : [],
        openedChestTokenId: show ? tokenId || null : null,
      });
    },

    setOpenedChestTokenId: (tokenId: string | null) => {
      set({
        openedChestTokenId: tokenId,
      });
    },

    clearLootChestOpening: () =>
      set({
        showLootChestOpening: false,
        chestAssets: [],
        openedChestTokenId: null,
      }),
  }));

// Create a single global store instance
const globalStore = createLootChestOpeningStore();

// Hook to use the global store instance
export const useLootChestOpeningStore = () => {
  return {
    showLootChestOpening: useStore(globalStore, (state) => state.showLootChestOpening),
    chestAssets: useStore(globalStore, (state) => state.chestAssets),
    openedChestTokenId: useStore(globalStore, (state) => state.openedChestTokenId),
    setShowLootChestOpening: useStore(globalStore, (state) => state.setShowLootChestOpening),
    setOpenedChestTokenId: useStore(globalStore, (state) => state.setOpenedChestTokenId),
    clearLootChestOpening: useStore(globalStore, (state) => state.clearLootChestOpening),
  };
};
