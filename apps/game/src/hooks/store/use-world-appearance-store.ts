import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { TerrainFogStyle } from "@/three/terrain/terrain-fog-style";

interface WorldAppearanceState {
  fogStyle: TerrainFogStyle;
  reducedMotion: boolean;
  setFogStyle: (fogStyle: TerrainFogStyle) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
}

/** Presentation preferences only; explored cells continue to come from the world snapshot. */
export const useWorldAppearanceStore = create<WorldAppearanceState>()(
  persist(
    (set) => ({
      fogStyle: "clear",
      reducedMotion: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
      setFogStyle: (fogStyle) => set({ fogStyle }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    {
      name: "eternum-world-appearance",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ fogStyle, reducedMotion }) => ({ fogStyle, reducedMotion }),
    },
  ),
);
