import { animate } from "framer-motion";
import { useEffect, useLayoutEffect, useRef } from "react";
import { EASE, tickDurationMs } from "./motion-scale";
import { useReducedMotion } from "./motion-settings";

/**
 * A counter that rolls to its new value in tabular numerals, then pulses. It writes the text through a ref, so a
 * roll never re-renders React per frame. Reduced motion jumps to the value with one highlight.
 */
export const TickNumber = ({
  value,
  format = (amount) => Math.round(amount).toLocaleString(),
  speed = 1,
  nudge = 0,
  className,
}: {
  value: number;
  format?: (amount: number) => string;
  speed?: number;
  /** Bump to pulse the counter without restarting its roll, as each later coin lands. */
  nudge?: number;
  className?: string;
}) => {
  const reduced = useReducedMotion();
  const element = useRef<HTMLSpanElement>(null);
  // The number on screen: a roll interrupted by a new value continues from where it is, never jumps back.
  const shown = useRef(value);
  // The latest format, read at write time: a new format function never restarts a roll in flight.
  const formatRef = useRef(format);
  formatRef.current = format;

  // React never owns the text: it is written once before the first paint, then only by the roll.
  useLayoutEffect(() => {
    if (element.current) element.current.textContent = formatRef.current(shown.current);
  }, []);

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const from = shown.current;
    if (from === value) return;
    if (reduced) {
      shown.current = value;
      node.textContent = formatRef.current(value);
      const highlight = animate(node, { opacity: [0.4, 1] }, { duration: 0.15 });
      return () => highlight.stop();
    }
    const roll = animate(from, value, {
      duration: tickDurationMs(value - from, speed) / 1000,
      ease: EASE.outQuart,
      onUpdate: (amount) => {
        shown.current = amount;
        node.textContent = formatRef.current(amount);
      },
      onComplete: () => {
        animate(node, { scale: [1, 1.12, 1] }, { duration: 0.2, ease: EASE.outQuart });
      },
    });
    return () => roll.stop();
  }, [reduced, speed, value]);

  useEffect(() => {
    if (nudge === 0 || reduced || !element.current) return;
    const pulse = animate(element.current, { scale: [1, 1.06, 1] }, { duration: 0.12, ease: EASE.outQuart });
    return () => pulse.stop();
  }, [nudge, reduced]);

  return <span ref={element} className={`inline-block tabular-nums ${className ?? ""}`} />;
};
