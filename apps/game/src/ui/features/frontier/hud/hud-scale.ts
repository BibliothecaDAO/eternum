import { useEffect, useState } from "react";

/** The width the desktop HUD is drawn for at its own size. */
const DESIGN_WIDTH = 1920;
/** How far the HUD shrinks on a narrow desktop and grows on a wide one. */
const SMALLEST = 0.85;
const LARGEST = 1.33;

/**
 * How much bigger Frontier's desktop HUD draws on a bigger screen (the owner, 22 October: "the hud should scale a bit
 * more with screen size for desktop"): its own size at 1920 wide, a third bigger at 2560, and down to 0.85 on a
 * 1440-wide laptop, so the map keeps its share of every screen.
 */
export const hudScaleFor = (width: number): number => Math.min(LARGEST, Math.max(SMALLEST, width / DESIGN_WIDTH));

/** The HUD's scale for the window's width as it is now, following it as it resizes. */
export const useHudScale = (): number => {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const follow = () => setWidth(window.innerWidth);
    window.addEventListener("resize", follow);
    return () => window.removeEventListener("resize", follow);
  }, []);
  return hudScaleFor(width);
};
