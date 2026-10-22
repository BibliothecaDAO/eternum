import { useSyncExternalStore } from "react";

import { DESKTOP_MIN_PX } from "@/tokens";

/** The two layouts on one foundation: a phone composition below the desktop width, the desktop one at and above it. */
type Layout = "phone" | "desktop";

// The same width as Tailwind's `lg`, so the JS layout and the stylesheet switch together.
const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_PX}px)`;

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const currentLayout = (): Layout => (window.matchMedia(DESKTOP_QUERY).matches ? "desktop" : "phone");

/** The layout now, for code outside React (the map's input): the same answer `useLayout` gives. */
export const layoutNow = (): Layout => (typeof window === "undefined" ? "phone" : currentLayout());

// A server render has no viewport; it draws the phone, the first layout.
export const useLayout = (): Layout => useSyncExternalStore(subscribe, currentLayout, () => "phone");

/**
 * A phone held sideways: too short for bands stacked top to bottom, so the phone's HUD stands in a rail at one side and
 * a column at the other (owner, 22 October 2026: mobile direction A, sideways as C). Its CSS twin is the same query in
 * hud-sheet.css.
 */
const SIDEWAYS_QUERY = "(orientation: landscape) and (max-height: 520px)";

const subscribeSideways = (onChange: () => void) => {
  const query = window.matchMedia(SIDEWAYS_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export const useSideways = (): boolean =>
  useSyncExternalStore(
    subscribeSideways,
    () => window.matchMedia(SIDEWAYS_QUERY).matches,
    () => false,
  );
