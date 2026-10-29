import { useEffect } from "react";

/** Less than this lost at the screen's foot is a browser bar coming and going, not an on-screen keyboard. */
const KEYBOARD_LEAST_PX = 120;

/**
 * How much of the layout viewport's foot the visual viewport no longer shows: the on-screen keyboard, which on a phone
 * overlays the page (Android Chrome) or pushes the visible part up (iOS Safari) while the layout stays as it was.
 */
const keyboardInsetOf = (layoutHeight: number, visual: { height: number; offsetTop: number }): number => {
  const inset = Math.round(layoutHeight - visual.height - visual.offsetTop);
  return inset >= KEYBOARD_LEAST_PX ? inset : 0;
};

/**
 * The on-screen keyboard, for every layout that stands on the screen's foot: `--keyboard` on the root is how tall it is
 * (0 when closed), so a phone's page, HUD and chat end above it, and `data-keyboard` marks it open, so what stands at
 * the foot for moving between places (marked `data-keyboard-hides`) steps aside while the player types. Read from the
 * visual viewport as it changes.
 */
export const useKeyboardInset = () =>
  useEffect(() => {
    const visual = window.visualViewport;
    if (!visual) return;
    const root = document.documentElement;
    const update = () => {
      const inset = keyboardInsetOf(root.clientHeight, visual);
      root.style.setProperty("--keyboard", `${inset}px`);
      if (inset > 0) root.dataset.keyboard = "open";
      else delete root.dataset.keyboard;
    };
    update();
    visual.addEventListener("resize", update);
    visual.addEventListener("scroll", update);
    return () => {
      visual.removeEventListener("resize", update);
      visual.removeEventListener("scroll", update);
      root.style.removeProperty("--keyboard");
      delete root.dataset.keyboard;
    };
  }, []);
