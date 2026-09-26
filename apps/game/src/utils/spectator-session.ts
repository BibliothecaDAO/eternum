/**
 * Session-level spectator intent — the single source of truth.
 *
 * Two related but distinct concepts exist:
 *
 *  - `isExplicitSpectateSession()`: the player ENTERED this play session as a
 *    spectator (`?spectate=true`). Latched by `resolveSpectateIntent` wherever a
 *    play route is resolved, while the entry URL is intact — in-app navigation
 *    can strip the query param, so the live URL is only a fallback. Wins over
 *    every ownership-based auto-flip: spectating a game where the logged-in
 *    account owns structures is a supported, deliberate state, and the HUD must
 *    show no ownership chrome for it.
 *
 *  - `useUIStore.isSpectating`: live HUD state. May flip to false mid-session
 *    when a NON-explicit spectator settles their first structure.
 *
 * Every spectator-sensitive feature must read these instead of reimplementing
 * URL/account heuristics — each ad-hoc copy shipped its own bug (auto
 * allocate_shares tx spam, ownership chrome shown while spectating,
 * account-modal bypass drift). This module is the only reader of the
 * `spectate` query; route builders may still write it.
 *
 * The intent lives only inside a play session: the shell (home, lobby, results, account) is outside every one, so
 * reaching it ends the intent, and a spectated game never makes the signed-in player a spectator outside it.
 */

import { useEffect } from "react";

/** The one parse of the `spectate` query. Route rewrites use it to carry the flag through a legacy URL. */
export const hasSpectateQuery = (search: string): boolean => new URLSearchParams(search).get("spectate") === "true";

let sessionSpectateIntent: boolean | null = null;

/** Resolves the intent from a play-route location and latches it for the session. */
export const resolveSpectateIntent = (location: Pick<Location, "search">): boolean => {
  sessionSpectateIntent = hasSpectateQuery(location.search);
  return sessionSpectateIntent;
};

/** A deliberate user action (exit-spectator flow) may override the intent. */
export const overrideSpectateIntent = (spectating: boolean): void => {
  sessionSpectateIntent = spectating;
};

/** The shell is outside every play session: mounting it ends any spectate intent a game latched. */
export const useOutsidePlaySession = (): void => {
  useEffect(() => {
    sessionSpectateIntent = null;
  }, []);
};

export const isExplicitSpectateSession = (): boolean =>
  sessionSpectateIntent ?? (typeof window !== "undefined" && hasSpectateQuery(window.location.search));
