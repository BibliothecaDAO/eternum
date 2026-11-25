import { useEffect, useState } from "react";

const SCALE_AT_WIDTH: readonly (readonly [width: number, scale: number])[] = [
  [1_024, 0.71],
  [1_280, 0.93],
  [1_440, 1],
  [1_920, 1],
  [2_560, 1.05],
];

export const hudScaleFor = (width: number): number => {
  const [first] = SCALE_AT_WIDTH;
  if (width <= first![0]) return first![1];
  for (let index = 1; index < SCALE_AT_WIDTH.length; index++) {
    const [fromWidth, fromScale] = SCALE_AT_WIDTH[index - 1]!;
    const [toWidth, toScale] = SCALE_AT_WIDTH[index]!;
    if (width <= toWidth) return fromScale + ((width - fromWidth) / (toWidth - fromWidth)) * (toScale - fromScale);
  }
  return SCALE_AT_WIDTH[SCALE_AT_WIDTH.length - 1]![1];
};

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
