import { useSyncExternalStore } from "react";

/** Below Tailwind's `lg` breakpoint the HUD collapses into the compact tab-bar shell. */
export const COMPACT_HUD_MEDIA_QUERY = "(max-width: 1023px)";

const compactHudQuery = (): MediaQueryList | null =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(COMPACT_HUD_MEDIA_QUERY)
    : null;

const subscribe = (onChange: () => void) => {
  const query = compactHudQuery();
  if (!query) return () => {};
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** The one compact-lane predicate, for code that places things outside React's render (popover placement). */
export const isCompactViewport = (): boolean => compactHudQuery()?.matches ?? false;

const getServerSnapshot = () => false;

/** The one compact-lane signal: true when the viewport is narrower than the desktop HUD needs. */
export const useCompactHud = (): boolean => useSyncExternalStore(subscribe, isCompactViewport, getServerSnapshot);
