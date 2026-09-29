import { animate, motion, useMotionValue } from "framer-motion";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { INTENSITY, type Intensity } from "./motion-scale";
import { useReducedMotion } from "./motion-settings";

/**
 * A wobble at 2 Hz while a result is pending. It never ends on a guess: it settles only once `pending` is false and at
 * least `minMs` (plus the intensity's extra hold) has passed, then calls `onSettled`. Reduced motion holds still.
 */
export const Hold = ({
  children,
  pending,
  intensity,
  minMs,
  onSettled,
  className,
}: {
  children: ReactNode;
  pending: boolean;
  intensity: Intensity;
  minMs: number;
  onSettled: () => void;
  className?: string;
}) => {
  const reduced = useReducedMotion();
  const rotate = useMotionValue(0);
  const startedAt = useRef(performance.now());
  const [settled, setSettled] = useState(false);

  // The wobble runs until the hold settles, then eases back upright.
  useEffect(() => {
    if (reduced || settled) return;
    const amplitude = INTENSITY.holdAmplitudeDeg[intensity];
    const wobble = animate(rotate, [0, amplitude, -amplitude, 0], {
      duration: 0.5,
      repeat: Infinity,
      ease: "easeInOut",
    });
    return () => {
      wobble.stop();
      animate(rotate, 0, { duration: 0.12 });
    };
  }, [intensity, reduced, rotate, settled]);

  useEffect(() => {
    if (pending || settled) return;
    const wait = Math.max(0, startedAt.current + minMs + INTENSITY.extraHoldMs[intensity] - performance.now());
    const id = window.setTimeout(() => {
      setSettled(true);
      onSettled();
    }, wait);
    return () => window.clearTimeout(id);
  }, [intensity, minMs, onSettled, pending, settled]);

  return (
    <motion.div className={className} style={{ rotate }}>
      {children}
    </motion.div>
  );
};
