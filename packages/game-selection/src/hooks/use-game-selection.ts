import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chain, FactoryWorld, GameSelectionState } from "../types";

const STORAGE_KEY = "eternum-game-selection";

/**
 * Zustand store for game/world selection state.
 * Persists to localStorage for cross-session persistence.
 */
export const useGameSelection = create<GameSelectionState>()(
  persist(
    (set) => ({
      selectedWorld: null,
      selectedChain: "mainnet" as Chain,

      selectWorld: (world: FactoryWorld) =>
        set({
          selectedWorld: world,
          selectedChain: world.chain,
        }),

      setSelectedChain: (chain: Chain) =>
        set({
          selectedChain: chain,
          // Clear world selection when chain changes
          selectedWorld: null,
        }),

      clearSelection: () =>
        set({
          selectedWorld: null,
        }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        selectedWorld: state.selectedWorld,
        selectedChain: state.selectedChain,
      }),
    },
  ),
);

/**
 * Check if a world is currently selected
 */
export function hasSelectedWorld(): boolean {
  return useGameSelection.getState().selectedWorld !== null;
}

/**
 * Get the currently selected world (for use outside React)
 */
export function getSelectedWorld(): FactoryWorld | null {
  return useGameSelection.getState().selectedWorld;
}

/**
 * Get the currently selected chain (for use outside React)
 */
export function getSelectedChain(): Chain {
  return useGameSelection.getState().selectedChain;
}
