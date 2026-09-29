import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { POP_SPRING } from "./motion-scale";
import { useReducedMotion } from "./motion-settings";

/** Scale in with overshoot: cards, badges and labels arriving. Reduced motion cross-fades in 150 ms instead. */
export const Pop = ({
  children,
  delayMs = 0,
  className,
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={reduced ? { duration: 0.15 } : { ...POP_SPRING, delay: delayMs / 1000 }}
    >
      {children}
    </motion.div>
  );
};
