import type { ID } from "@bibliothecadao/types";
import { create } from "zustand";

/**
 * What Next up shows now: whose Provision or Level up it offers, so another surface offering the same stays secondary
 * (the screen's one filled gold button is Next up's), and its step's action while it can be taken, which `Space` runs.
 * Empty while Next up shows nothing or is not mounted (the phone HUD has none).
 */
interface NextUpShown {
  /** Whether Next up shows a step, and the realm whose Provision or Level up it is, if it is one. */
  shown: { levelUpOf: ID | null } | null;
  /** The shown step's action, while it can be taken. */
  act: (() => void) | null;
}

export const useNextUpShows = create<NextUpShown>(() => ({ shown: null, act: null }));

/** Whether Next up is offering this realm's Provision or Level up, which any other of its buttons then leaves to it. */
export const useNextUpOffersLevelUp = (realmId: ID | null) =>
  useNextUpShows((state) => realmId !== null && state.shown?.levelUpOf === realmId);
