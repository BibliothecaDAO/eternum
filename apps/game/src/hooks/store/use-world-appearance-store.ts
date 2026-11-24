import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { TerrainFogStyle } from "@/three/terrain/terrain-fog-style";

interface WorldAppearanceState {
  fogStyle: TerrainFogStyle;
  reducedMotion: boolean;
  /** Vibration on big moments where the device supports it (Android); in the iOS app, a tap on a confirmed action. */
  haptics: boolean;
  /** The Frontier HUD shows every part from the start, not as the player reaches each. */
  showEverything: boolean;
  setFogStyle: (fogStyle: TerrainFogStyle) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setHaptics: (haptics: boolean) => void;
  setShowEverything: (showEverything: boolean) => void;
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
      showEverything: false,
      setShowEverything: (showEverything) => set({ showEverything }),
    }),
    {
      name: "eternum-world-appearance",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ fogStyle, reducedMotion, haptics, showEverything }) => ({
        fogStyle,
        reducedMotion,
        haptics,
        showEverything,
      }),
    },
  ),
);
