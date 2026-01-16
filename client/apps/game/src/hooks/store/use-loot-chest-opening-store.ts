import { create } from "zustand";
import { ChestAsset } from "@/ui/features/landing/chest-opening/utils/cosmetics";

interface LootChestOpeningStore {
  // State
  showLootChestOpening: boolean;
  chestAssets: ChestAsset[];
  openedChestTokenId: string | null;
  chestOpenTimestamp: number;

  // Actions
  setShowLootChestOpening: (show: boolean, assets?: ChestAsset[], tokenId?: string) => void;
  setOpenedChestTokenId: (tokenId: string | null) => void;
  setChestOpenTimestamp: (timestamp: number) => void;
  clearLootChestOpening: () => void;
}

export const useLootChestOpeningStore = create<LootChestOpeningStore>((set) => ({
  // Initial state
  showLootChestOpening: false,
  chestAssets: [],
  openedChestTokenId: null,
  chestOpenTimestamp: 0,

  // Actions
  setShowLootChestOpening: (show, assets = [], tokenId = undefined) =>
    set({
      showLootChestOpening: show,
      chestAssets: assets,
      openedChestTokenId: tokenId ?? null,
    }),

  setOpenedChestTokenId: (tokenId) => set({ openedChestTokenId: tokenId }),

  setChestOpenTimestamp: (timestamp) => set({ chestOpenTimestamp: timestamp }),

  clearLootChestOpening: () =>
    set({
      showLootChestOpening: false,
      chestAssets: [],
      openedChestTokenId: null,
      chestOpenTimestamp: 0,
    }),
}));
