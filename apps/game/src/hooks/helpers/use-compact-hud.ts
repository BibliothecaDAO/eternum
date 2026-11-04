import { useSyncExternalStore } from "react";

import { DESKTOP_MIN_PX } from "@/tokens";

/** Below Tailwind's `lg` breakpoint the HUD collapses into the compact tab-bar shell. */
export const COMPACT_HUD_MEDIA_QUERY = `(max-width: ${DESKTOP_MIN_PX - 1}px)`;
/**
 * A screen held sideways below the desktop's width (a phone, a Fold's inner screen, a 7–10" tablet): still compact, but
 * the budget is horizontal, so the HUD stands in a rail at one side and a column at the other. hud-sheet.css writes the
 * same query wherever it lays the sideways HUD out; hud-sheet-queries.test.ts fails a copy that differs.
 */
export const COMPACT_LANDSCAPE_MEDIA_QUERY = `${COMPACT_HUD_MEDIA_QUERY} and (orientation: landscape)`;

/** Which way the compact shell is laid out; null is the desktop lane. */
export type CompactLane = "portrait" | "landscape";

const mediaQuery = (query: string): MediaQueryList | null =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query) : null;

/**
 * The one compact-lane signal, for code that places things outside React's render (popover placement). Null when
 * the viewport is wide enough for the desktop HUD or there is no `matchMedia` to ask.
 */
export const resolveCompactLane = (): CompactLane | null => {
  if (!mediaQuery(COMPACT_HUD_MEDIA_QUERY)?.matches) return null;
  return mediaQuery(COMPACT_LANDSCAPE_MEDIA_QUERY)?.matches ? "landscape" : "portrait";
};

const subscribe = (onChange: () => void) => {
  const queries = [mediaQuery(COMPACT_HUD_MEDIA_QUERY), mediaQuery(COMPACT_LANDSCAPE_MEDIA_QUERY)];
  queries.forEach((query) => query?.addEventListener("change", onChange));
  return () => queries.forEach((query) => query?.removeEventListener("change", onChange));
};

const getServerSnapshot = (): CompactLane | null => null;

/** The compact lane as a React subscription; re-renders when the width crosses `lg` or the phone rotates. */
export const useCompactLane = (): CompactLane | null =>
  useSyncExternalStore(subscribe, resolveCompactLane, getServerSnapshot);
