import { useSyncExternalStore } from "react";

import { COMPACT_LANDSCAPE_MEDIA_QUERY } from "@/hooks/helpers/use-compact-hud";
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

const subscribeSideways = (onChange: () => void) => {
  const query = window.matchMedia(COMPACT_LANDSCAPE_MEDIA_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/**
 * A screen held sideways below the desktop's width: the phone's HUD stands in a rail at one side and a column at the
 * other (owner, 22 October 2026: mobile direction A, sideways as C). Any such screen, not only a short one (owner, 4
 * November: a Fold's inner screen and tablets held sideways had the upright bands with full-width sheets, the map a third
 * of the screen).
 */
export const useSideways = (): boolean =>
  useSyncExternalStore(
    subscribeSideways,
    () => window.matchMedia(COMPACT_LANDSCAPE_MEDIA_QUERY).matches,
    () => false,
  );
