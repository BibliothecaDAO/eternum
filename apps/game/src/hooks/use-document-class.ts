import { useEffect } from "react";

/** How many mounted surfaces hold each class; a class goes only when the last one holding it unmounts. */
const holders = new Map<string, number>();

/**
 * Sets a class on <html> while the calling surface is mounted, so popovers, sheets and menus rendered outside the
 * surface follow it. Surfaces overlap (a HUD mounts before the one it replaces unmounts), so the class is counted,
 * never toggled.
 */
export const useDocumentClass = (name: string): void => {
  useEffect(() => {
    holders.set(name, (holders.get(name) ?? 0) + 1);
    document.documentElement.classList.add(name);
    return () => {
      const left = (holders.get(name) ?? 1) - 1;
      holders.set(name, left);
      if (left === 0) document.documentElement.classList.remove(name);
    };
  }, [name]);
};
