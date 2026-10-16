import { create } from "zustand";

/**
 * Whether Next up shows a step now, and that step's action while it can be taken (which `Space` runs). While it shows
 * one, its button is the screen's one filled gold action, whatever the step is, and every other surface's own action
 * reads as secondary. False while Next up shows nothing or is not mounted (the phone HUD has none).
 */
interface NextUpShown {
  showing: boolean;
  act: (() => void) | null;
}

export const useNextUpShows = create<NextUpShown>(() => ({ showing: false, act: null }));

/** Whether Next up holds the screen's one filled gold action now, which another surface's action then leaves to it. */
export const useNextUpHoldsPrimary = () => useNextUpShows((state) => state.showing);
