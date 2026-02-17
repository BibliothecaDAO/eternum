import { MergedNftData } from "@/types";
import { formatUnits } from "viem";
import { createStore, StoreApi, useStore } from "zustand";

interface SelectedPassesStore {
  selectedPasses: MergedNftData[];
  togglePass: (pass: MergedNftData) => void;
  replaceSelection: (passes: MergedNftData[]) => void;
  removeSelection: (tokenIds: string[]) => void;
  clearSelection: () => void;
  isSelected: (tokenId: string) => boolean;
  getTotalPrice: () => number;
}

// Create a map to store different instances of the store
const storeInstances = new Map<string, StoreApi<SelectedPassesStore>>();

// Factory function to create a store instance
export const createSelectedPassesStore = () =>
  createStore<SelectedPassesStore>((set, get) => ({
    selectedPasses: [],

    togglePass: (pass: MergedNftData) => {
      set((state) => {
        const isSelected = state.selectedPasses.some((p) => p.token_id === pass.token_id);
        if (isSelected) {
          return {
            selectedPasses: state.selectedPasses.filter((p) => p.token_id !== pass.token_id),
          };
        } else {
          return {
            selectedPasses: [...state.selectedPasses, pass],
          };
        }
      });
    },

    replaceSelection: (passes: MergedNftData[]) => {
      set({ selectedPasses: passes });
    },

    removeSelection: (tokenIds: string[]) => {
      if (tokenIds.length === 0) return;
      const ids = new Set(tokenIds.map((id) => String(id)));
      set((state) => ({
        selectedPasses: state.selectedPasses.filter((pass) => !ids.has(String(pass.token_id))),
      }));
    },

    clearSelection: () => set({ selectedPasses: [] }),

    isSelected: (tokenId: string) => {
      return get().selectedPasses.some((p) => p.token_id.toString() === tokenId);
    },

    getTotalPrice: () => {
      return get().selectedPasses.reduce(
        (sum, pass) => sum + (pass.best_price_hex ? Number(formatUnits(BigInt(pass.best_price_hex), 18)) : 0),
        0,
      );
    },
  }));

// Hook to get or create a store instance for a specific page
export const useSelectedPassesStore = (pageId: string) => {
  if (!storeInstances.has(pageId)) {
    storeInstances.set(pageId, createSelectedPassesStore());
  }
  const store = storeInstances.get(pageId)!;
  return {
    selectedPasses: useStore(store, (state) => state.selectedPasses),
    togglePass: useStore(store, (state) => state.togglePass),
    replaceSelection: useStore(store, (state) => state.replaceSelection),
    removeSelection: useStore(store, (state) => state.removeSelection),
    clearSelection: useStore(store, (state) => state.clearSelection),
    isSelected: useStore(store, (state) => state.isSelected),
    getTotalPrice: useStore(store, (state) => state.getTotalPrice),
  };
};
