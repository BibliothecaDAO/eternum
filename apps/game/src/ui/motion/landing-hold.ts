import { useRef } from "react";
import { create } from "zustand";

/**
 * Counters a sprite is flying to. A held counter keeps the number it showed until the sprite lands, so its roll starts
 * on the landing, never before it. A counter is named by its `data-fly-target`.
 */
const useHolds = create<Record<string, number>>(() => ({}));

/** Holds a counter until the returned release runs; releasing twice is harmless. */
export const holdUntilLanding = (target: string): (() => void) => {
  useHolds.setState((holds) => ({ [target]: (holds[target] ?? 0) + 1 }));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    useHolds.setState((holds) => ({ [target]: Math.max(0, (holds[target] ?? 0) - 1) }));
  };
};

/** What a counter shows: its live value, or while a sprite is on its way, the value it showed before the flight. */
export const useLandedValue = <T>(target: string, value: T): T => {
  const held = useHolds((holds) => (holds[target] ?? 0) > 0);
  const shown = useRef(value);
  if (!held) shown.current = value;
  return shown.current;
};
