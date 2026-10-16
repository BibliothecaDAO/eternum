import type { ID } from "@bibliothecadao/types";
import { create } from "zustand";

/**
 * What Next up shows now, so another surface offering the same action stays secondary: the screen's one filled gold
 * button is Next up's. Null while Next up shows nothing or is not mounted (the phone HUD has none).
 */
type NextUpShown = {
  /** The realm whose Provision or Level up Next up offers, if that is its step. */
  levelUpOf: ID | null;
} | null;

export const useNextUpShows = create<{ shown: NextUpShown }>(() => ({ shown: null }));

/** Whether Next up is offering an action now: an alert's own control (Attention) then reads as secondary. */
export const useNextUpOffersAction = () => useNextUpShows((state) => state.shown !== null);

/** Whether Next up is offering this realm's Provision or Level up, which any other of its buttons then leaves to it. */
export const useNextUpOffersLevelUp = (realmId: ID | null) =>
  useNextUpShows((state) => realmId !== null && state.shown?.levelUpOf === realmId);
