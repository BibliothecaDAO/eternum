import { animate } from "framer-motion";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EASE } from "./motion-scale";
import { useReducedMotion } from "./motion-settings";
import { TickNumber } from "./tick-number";

/**
 * A HUD counter that sprites land on: its icon to the left is the landing target, so arriving sprites never cover the
 * digits, and each landing pulses the icon with the number. The forwarded ref is the icon, for `flySprites`' `to`.
 */
export const LandingCounter = forwardRef<
  HTMLImageElement,
  { icon: string; value: number; nudge: number; speed?: number; className?: string }
>(({ icon, value, nudge, speed = 1, className }, ref) => {
  const reduced = useReducedMotion();
  const target = useRef<HTMLImageElement>(null);
  useImperativeHandle(ref, () => target.current!);

  useEffect(() => {
    if (nudge === 0 || reduced || !target.current) return;
    const pulse = animate(target.current, { scale: [1, 1.18, 1] }, { duration: 0.14, ease: EASE.outQuart });
    return () => pulse.stop();
  }, [nudge, reduced]);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <img ref={target} src={icon} alt="" className="h-5 w-5 drop-shadow-[0_0_3px_rgba(223,170,84,0.95)]" />
      <TickNumber value={value} speed={speed} nudge={nudge} />
    </span>
  );
});
LandingCounter.displayName = "LandingCounter";
