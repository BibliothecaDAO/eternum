import type { ChestOpenedSystemUpdate } from "@bibliothecadao/eternum";
import { create } from "zustand";

/** An opened chest in the current world, kept by hex so the tile panel can keep its reward receipt after the chest tile is gone. */
export type ChestOpening = ChestOpenedSystemUpdate;

interface ChestOpeningState {
  openings: Record<string, ChestOpening>;
  recordOpening: (opening: ChestOpening) => void;
}

const OPENINGS_KEPT = 32;

const chestHexKey = (hex: { x: number; y: number }) => `${hex.x},${hex.y}`;

export const useChestOpeningStore = create<ChestOpeningState>((set) => ({
  openings: {},
  recordOpening: (opening) =>
    set((state) => {
      const entries = Object.entries(state.openings).filter(([key]) => key !== chestHexKey(opening.hex));
      entries.push([chestHexKey(opening.hex), opening]);
      return { openings: Object.fromEntries(entries.slice(-OPENINGS_KEPT)) };
    }),
}));

export const useChestOpening = (hex: { col: number; row: number } | null): ChestOpening | null =>
  useChestOpeningStore((state) => (hex ? (state.openings[chestHexKey({ x: hex.col, y: hex.row })] ?? null) : null));
