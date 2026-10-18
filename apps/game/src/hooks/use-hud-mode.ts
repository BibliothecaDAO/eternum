import type { HudMode } from "@/tokens";
import { useEffect } from "react";

/**
 * Sets the game's age on <html> (`data-hud-mode`) while its HUD is mounted, so the HUD sheet's accent and surface
 * (tokens.ts HUD_MODES) reach every surface it draws, popovers and windows rendered outside the HUD included.
 */
export const useHudMode = (mode: HudMode): void => {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.hudMode = mode;
    return () => {
      if (root.dataset.hudMode === mode) delete root.dataset.hudMode;
    };
  }, [mode]);
};
