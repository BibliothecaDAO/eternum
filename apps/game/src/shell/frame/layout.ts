import { useSyncExternalStore } from "react";

import { DESKTOP_MIN_PX } from "@/tokens";

/** The two layouts on one foundation: a phone composition below the desktop width, the desktop one at and above it. */
type Layout = "phone" | "desktop";

// The same width as Tailwind's `lg`, so the JS layout and the stylesheet switch together.
const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_PX}px)`;

const mediaStore = (query: string) => ({
  subscribe: (onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  },
  matches: () => window.matchMedia(query).matches,
});

const DESKTOP = mediaStore(DESKTOP_QUERY);

const currentLayout = (): Layout => (DESKTOP.matches() ? "desktop" : "phone");

export const layoutNow = (): Layout => (typeof window === "undefined" ? "phone" : currentLayout());

// A server render has no viewport; it draws the phone, the first layout.
export const useLayout = (): Layout => useSyncExternalStore(DESKTOP.subscribe, currentLayout, () => "phone");
