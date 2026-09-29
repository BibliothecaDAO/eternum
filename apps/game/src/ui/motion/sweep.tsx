import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE } from "./motion-scale";
import { useReducedMotion } from "./motion-settings";

/**
 * A shine passing once across a card, plot or chip, replayed whenever `play` changes. Reduced motion shows the thing
 * without the shine.
 */
export const Sweep = ({
  children,
  play,
  durationMs = 500,
  className,
}: {
  children: ReactNode;
  play: number;
  durationMs?: number;
  className?: string;
}) => {
  const reduced = useReducedMotion();
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      {children}
      {!reduced && play > 0 && (
        <motion.span
          key={play}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent"
          initial={{ x: "0%" }}
          animate={{ x: "400%" }}
          transition={{ duration: durationMs / 1000, ease: EASE.inOutCubic }}
        />
      )}
    </div>
  );
};
