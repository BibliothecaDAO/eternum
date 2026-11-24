import { useSyncExternalStore } from "react";

import { COMPACT_LANDSCAPE_MEDIA_QUERY } from "@/hooks/helpers/use-compact-hud";
import { DESKTOP_MIN_PX, TABLET_MIN_PX } from "@/tokens";

/** The two layouts on one foundation: a phone composition below the desktop width, the desktop one at and above it. */
type Layout = "phone" | "desktop";

// The same width as Tailwind's `lg`, so the JS layout and the stylesheet switch together.
const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_PX}px)`;

const TABLET_QUERY = `(min-width: ${TABLET_MIN_PX}px) and (max-width: ${DESKTOP_MIN_PX - 1}px) and (orientation: portrait)`;

const mediaStore = (query: string) => ({
  subscribe: (onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  },
  matches: () => window.matchMedia(query).matches,
});

const DESKTOP = mediaStore(DESKTOP_QUERY);
const SIDEWAYS = mediaStore(COMPACT_LANDSCAPE_MEDIA_QUERY);
const TABLET = mediaStore(TABLET_QUERY);

const useMedia = (store: ReturnType<typeof mediaStore>): boolean =>
  useSyncExternalStore(store.subscribe, store.matches, () => false);

const currentLayout = (): Layout => (DESKTOP.matches() ? "desktop" : "phone");

/** The layout now, for code outside React (the map's input): the same answer `useLayout` gives. */
export const layoutNow = (): Layout => (typeof window === "undefined" ? "phone" : currentLayout());

// A server render has no viewport; it draws the phone, the first layout.
export const useLayout = (): Layout => useSyncExternalStore(DESKTOP.subscribe, currentLayout, () => "phone");

/**
 * A screen held sideways below the desktop's width: the phone's HUD stands in a rail at one side and a column at the
 * other (owner, 22 October 2026: mobile direction A, sideways as C). Any such screen, not only a short one (owner, 4
 * November: a Fold's inner screen and tablets held sideways had the upright bands with full-width sheets, the map a third
 * of the screen).
 */
export const useSideways = (): boolean => useMedia(SIDEWAYS);

export const useTablet = (): boolean => useMedia(TABLET);
