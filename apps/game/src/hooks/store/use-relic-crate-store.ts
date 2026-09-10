import type { RelicChestOpenedSystemUpdate } from "@bibliothecadao/eternum";
import { create } from "zustand";

/** A crate opened this session, kept by hex so the tile panel can list the relics after the crate tile is gone. */
export type RelicCrateOpening = RelicChestOpenedSystemUpdate;

interface RelicCrateState {
  openings: Record<string, RelicCrateOpening>;
  recordOpening: (opening: RelicCrateOpening) => void;
}

const OPENINGS_KEPT = 32;

const relicCrateHexKey = (hex: { x: number; y: number }) => `${hex.x},${hex.y}`;

export const useRelicCrateStore = create<RelicCrateState>((set) => ({
  openings: {},
  recordOpening: (opening) =>
    set((state) => {
      const entries = Object.entries(state.openings).filter(([key]) => key !== relicCrateHexKey(opening.hex));
      entries.push([relicCrateHexKey(opening.hex), opening]);
      return { openings: Object.fromEntries(entries.slice(-OPENINGS_KEPT)) };
    }),
}));

export const useRelicCrateOpening = (hex: { col: number; row: number }): RelicCrateOpening | null =>
  useRelicCrateStore((state) => state.openings[relicCrateHexKey({ x: hex.col, y: hex.row })] ?? null);
