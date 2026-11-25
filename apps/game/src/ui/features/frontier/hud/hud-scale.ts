import { useEffect, useState } from "react";

const DESIGN = { width: 1_440, height: 960 } as const;

const SCALE_AT_WIDTH: readonly (readonly [width: number, scale: number])[] = [
  [1_024, 0.71],
  [1_280, 0.93],
  [DESIGN.width, 1],
];

const widthScale = (width: number): number => {
  const [first] = SCALE_AT_WIDTH;
  if (width <= first![0]) return first![1];
  for (let index = 1; index < SCALE_AT_WIDTH.length; index++) {
    const [fromWidth, fromScale] = SCALE_AT_WIDTH[index - 1]!;
    const [toWidth, toScale] = SCALE_AT_WIDTH[index]!;
    if (width <= toWidth) return fromScale + ((width - fromWidth) / (toWidth - fromWidth)) * (toScale - fromScale);
  }
  return width / DESIGN.width;
};

export const hudScaleFor = (width: number, height: number): number =>
  Math.min(widthScale(width), height / DESIGN.height);

export const useHudScale = (): number => {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const follow = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", follow);
    return () => window.removeEventListener("resize", follow);
  }, []);
  return hudScaleFor(size.width, size.height);
};
