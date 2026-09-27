import { useEffect } from "react";

/** How many mounted surfaces hold the visual system; the class goes only when the last one unmounts. */
let holders = 0;

/**
 * The player app's visual system while the shell or a Frontier surface is mounted (index.css `html.frontier-type`):
 * Atkinson Hyperlegible body, Lexend headings and numbers, sentence case, and the Frontier tokens (chip, card, sheet,
 * primary). It sits on <html> so popovers, sheets and menus rendered outside the surface follow. Surfaces overlap (the
 * doorway leaves after the Frontier HUD has mounted), so the class is counted, never toggled.
 */
export const useFrontierType = (): void => {
  useEffect(() => {
    holders += 1;
    document.documentElement.classList.add("frontier-type");
    return () => {
      holders -= 1;
      if (holders === 0) document.documentElement.classList.remove("frontier-type");
    };
  }, []);
};
