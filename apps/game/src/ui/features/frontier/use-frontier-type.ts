import { useEffect } from "react";

/**
 * The player app's visual system while the shell or a Frontier surface is mounted (index.css `html.frontier-type`):
 * Atkinson Hyperlegible body, Lexend headings and numbers, sentence case, and the Frontier tokens (chip, card, sheet,
 * primary). It sits on <html> so popovers, sheets and menus rendered outside the surface follow.
 */
export const useFrontierType = (): void => {
  useEffect(() => {
    document.documentElement.classList.add("frontier-type");
    return () => document.documentElement.classList.remove("frontier-type");
  }, []);
};
