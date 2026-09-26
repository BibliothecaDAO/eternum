import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { create } from "zustand";

/** How long a used Well waits for its army's stamina to land; past it, a refused or lost refill plays nothing. */
const ARMED_MS = 8_000;
/** The refill beat on the bar: the fill sweeping up and the bar's glow. */
export const REFILL_BEAT_MS = 1_100;

const useArmedStore = create<{ armed: ReadonlySet<number> }>(() => ({ armed: new Set() }));

const setArmed = (explorerId: number, armed: boolean) =>
  useArmedStore.setState((state) => {
    const next = new Set(state.armed);
    if (armed) next.add(explorerId);
    else next.delete(explorerId);
    return { armed: next };
  });

/**
 * The acting card's own feedback for its Use: the army's bar plays the refill when that army's stamina next rises.
 * It never predicts the stamina; the bar only animates the fact it is given.
 */
export const armWellRefill = (explorerId: number): void => {
  setArmed(explorerId, true);
  setTimeout(() => setArmed(explorerId, false), ARMED_MS);
};

/**
 * A Well's refill on this army's bar: armed by the Use, started by the army's stamina rising. The bar holds the old
 * fill for a frame, then sweeps up to the new one, so the rise plays instead of jumping.
 */
export const useWellRefill = (explorerId: number, ratio: number): { refilling: boolean; shown: number } => {
  const armed = useArmedStore((state) => state.armed.has(explorerId));
  const previous = useRef(ratio);
  const [beat, setBeat] = useState<{ from: number; swept: boolean } | null>(null);

  // Before paint, so the risen fill never shows ahead of its sweep.
  useLayoutEffect(() => {
    if (armed && ratio > previous.current) {
      setArmed(explorerId, false);
      setBeat({ from: previous.current, swept: false });
    }
    previous.current = ratio;
  }, [armed, explorerId, ratio]);

  useEffect(() => {
    if (!beat) return;
    if (!beat.swept) {
      const frame = requestAnimationFrame(() => setBeat({ ...beat, swept: true }));
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(() => setBeat(null), REFILL_BEAT_MS);
    return () => clearTimeout(timer);
  }, [beat]);

  return { refilling: beat !== null, shown: beat && !beat.swept ? beat.from : ratio };
};
