import { create } from "zustand";

interface CosmeticLoadoutState {
  /**
   * Keeps track of the currently equipped cosmetic token per slot (keyed by the metadata `Type`).
   */
  selectedBySlot: Record<string, string>;
  addCosmetic: (slot: string, tokenId: string) => void;
  removeCosmetic: (slot: string) => void;
  clearAll: () => void;
  isTokenSelected: (tokenId: string) => boolean;
}

export const useCosmeticLoadoutStore = create<CosmeticLoadoutState>((set, get) => ({
  selectedBySlot: {},
  addCosmetic: (slot, tokenId) => {
    if (!slot || !tokenId) {
      return;
    }

    set((state) => {
      const current = state.selectedBySlot[slot];

      if (current === tokenId) {
        return state;
      }

      return {
        selectedBySlot: {
          ...state.selectedBySlot,
          [slot]: tokenId,
        },
      };
    });
  },
  removeCosmetic: (slot) => {
    if (!slot) {
      return;
    }

    set((state) => {
      if (!(slot in state.selectedBySlot)) {
        return state;
      }

      const next = { ...state.selectedBySlot };
      delete next[slot];

      return { selectedBySlot: next };
    });
  },
  clearAll: () => {
    set({ selectedBySlot: {} });
  },
  isTokenSelected: (tokenId) => {
    if (!tokenId) {
      return false;
    }

    const { selectedBySlot } = get();
    return Object.values(selectedBySlot).includes(tokenId);
  },
}));
