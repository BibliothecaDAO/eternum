import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { TerrainFogStyle } from "@/three/terrain/terrain-fog-style";

interface WorldAppearanceState {
  fogStyle: TerrainFogStyle;
  reducedMotion: boolean;
  /** Vibration on big moments where the device supports it (Android). */
  haptics: boolean;
  /** Next up's tips (the empire's suggestions); off, it still shows alerts and the selected realm's own step. */
  nextUpTips: boolean;
  setFogStyle: (fogStyle: TerrainFogStyle) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setHaptics: (haptics: boolean) => void;
  setNextUpTips: (nextUpTips: boolean) => void;
}

/** Presentation preferences only (persisted); explored cells continue to come from the world snapshot. */
export const useWorldAppearanceStore = create<WorldAppearanceState>()(
  persist(
    (set) => ({
      fogStyle: "clear",
      reducedMotion: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
      setFogStyle: (fogStyle) => set({ fogStyle }),
      haptics: true,
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setHaptics: (haptics) => set({ haptics }),
      nextUpTips: true,
      setNextUpTips: (nextUpTips) => set({ nextUpTips }),
    }),
    {
      name: "eternum-world-appearance",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ fogStyle, reducedMotion, haptics, nextUpTips }) => ({
        fogStyle,
        reducedMotion,
        haptics,
        nextUpTips,
      }),
    },
  ),
);
