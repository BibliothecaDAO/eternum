import { useSyncExternalStore } from "react";

/** The two layouts on one foundation: a phone composition below the desktop width, the desktop one at and above it. */
type Layout = "phone" | "desktop";

const DESKTOP_QUERY = "(min-width: 1024px)";

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const currentLayout = (): Layout => (window.matchMedia(DESKTOP_QUERY).matches ? "desktop" : "phone");

// A server render has no viewport; it draws the phone, the first layout.
export const useLayout = (): Layout => useSyncExternalStore(subscribe, currentLayout, () => "phone");
