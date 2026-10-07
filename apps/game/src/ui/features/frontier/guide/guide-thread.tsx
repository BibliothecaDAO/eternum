import { type RefObject, useEffect, useState } from "react";

import { GuideMarkIcon } from "./guide-card";
import type { GuideTarget } from "./guide-script";

/** The attribute a HUD control carries when a guide line may name it. */
export const guideTarget = (target: GuideTarget) => ({ "data-guide-target": target });

type Ends = { x1: number; y1: number; x2: number; y2: number };

/** The mark laid on the target, faint. */
const TARGET_MARK = 30;

/**
 * The guide's dashed gold thread from its card to the control its line names, with the mark laid faintly on the
 * control. Drawn only while both stand on screen; it follows them as the layout moves.
 */
export const GuideThread = ({ from, target }: { from: RefObject<HTMLElement | null>; target: GuideTarget }) => {
  const ends = useThreadEnds(from, target);
  if (!ends) return null;
  return (
    <>
      <svg aria-hidden className="pointer-events-none fixed inset-0 z-30 size-full">
        <line {...ends} className="stroke-kit-gold" strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round" />
      </svg>
      <span
        aria-hidden
        className="pointer-events-none fixed z-30 opacity-55"
        style={{ left: ends.x2 - TARGET_MARK / 2, top: ends.y2 - TARGET_MARK / 2 }}
      >
        <GuideMarkIcon mark="speaking" size={TARGET_MARK} />
      </span>
    </>
  );
};

/** The thread's two ends, measured each frame: the card's near edge and the target's centre. */
const useThreadEnds = (from: RefObject<HTMLElement | null>, target: GuideTarget): Ends | null => {
  const [ends, setEnds] = useState<Ends | null>(null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const next = measureEnds(from.current, document.querySelector(`[data-guide-target="${target}"]`));
      setEnds((previous) => (sameEnds(previous, next) ? previous : next));
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [from, target]);
  return ends;
};

const measureEnds = (card: Element | null, goal: Element | null): Ends | null => {
  const from = card?.getBoundingClientRect();
  const to = goal?.getBoundingClientRect();
  if (!from || !to || from.width === 0 || to.width === 0) return null;
  const y2 = to.top + to.height / 2;
  return {
    x1: from.left + from.width / 2,
    y1: y2 > from.bottom ? from.bottom : from.top,
    x2: to.left + to.width / 2,
    y2,
  };
};

const sameEnds = (left: Ends | null, right: Ends | null): boolean =>
  left === right ||
  (left !== null &&
    right !== null &&
    left.x1 === right.x1 &&
    left.y1 === right.y1 &&
    left.x2 === right.x2 &&
    left.y2 === right.y2);
