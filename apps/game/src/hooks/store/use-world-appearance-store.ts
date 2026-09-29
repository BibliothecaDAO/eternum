import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { TerrainFogStyle } from "@/three/terrain/terrain-fog-style";

interface WorldAppearanceState {
  fogStyle: TerrainFogStyle;
  reducedMotion: boolean;
  /** Vibration on big moments where the device supports it (Android). */
  haptics: boolean;
  setFogStyle: (fogStyle: TerrainFogStyle) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setHaptics: (haptics: boolean) => void;
}

/** Presentation preferences only; explored cells continue to come from the world snapshot. */
export const useWorldAppearanceStore = create<WorldAppearanceState>()(
  persist(
    (set) => ({
      fogStyle: "clear",
      reducedMotion: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
      setFogStyle: (fogStyle) => set({ fogStyle }),
      haptics: true,
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setHaptics: (haptics) => set({ haptics }),
    }),
    {
      name: "eternum-world-appearance",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ fogStyle, reducedMotion, haptics }) => ({ fogStyle, reducedMotion, haptics }),
    },
  ),
);
