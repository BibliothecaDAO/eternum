/**
 * Session-level spectator intent — the single source of truth.
 *
 * Two related but distinct concepts exist:
 *
 *  - `isExplicitSpectateSession()`: the player ENTERED this play session as a
 *    spectator (`?spectate=true`). Captured ONCE at bootstrap — in-app
 *    navigation can strip the query param, so the live URL is only a
 *    fallback. Wins over every ownership-based auto-flip: spectating a game
 *    where the logged-in account owns structures is a supported, deliberate
 *    state, and the HUD must show no ownership chrome for it.
 *
 *  - `useUIStore.isSpectating`: live HUD state. May flip to false mid-session
 *    when a NON-explicit spectator settles their first structure.
 *
 * Every spectator-sensitive feature must read these instead of reimplementing
 * URL/account heuristics — each ad-hoc copy shipped its own bug (auto
 * allocate_shares tx spam, ownership chrome shown while spectating,
 * account-modal bypass drift).
 */

const readSpectateParam = (): boolean =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("spectate") === "true";

let sessionSpectateIntent: boolean | null = null;

/** Called once per play-session bootstrap, while the entry URL is intact. */
export const captureSpectateIntentFromUrl = (): void => {
  sessionSpectateIntent = readSpectateParam();
};

/** A deliberate user action (exit-spectator flow) may override the intent. */
export const overrideSpectateIntent = (spectating: boolean): void => {
  sessionSpectateIntent = spectating;
};

export const isExplicitSpectateSession = (): boolean => sessionSpectateIntent ?? readSpectateParam();
