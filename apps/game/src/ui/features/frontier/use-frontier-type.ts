import { useEffect } from "react";

/**
 * Frontier's type while a Frontier surface is mounted (index.css `html.frontier-type`): Atkinson Hyperlegible body,
 * Lexend headings, sentence case. It sits on <html> so popovers, sheets and menus rendered outside the HUD follow.
 */
export const useFrontierType = (): void => {
  useEffect(() => {
    document.documentElement.classList.add("frontier-type");
    return () => document.documentElement.classList.remove("frontier-type");
  }, []);
};
