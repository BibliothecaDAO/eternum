import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { type ArmyProgressFacts, levelProgress, type ProgressionRulesFacts } from "./attributes";

const FILL_MS = 300;
const LEVEL_UP_MS = 400;

/**
 * An army's level and XP, from ArmyProgress: the level badge and a bar that fills as XP comes in (ease-out). On a
 * level-up the bar flashes full before the new level's fill, and the badge pops from 1.25 back to size. The motion is
 * driven from effects on the fact's changes, so the card's other re-renders (its countdown) never cut it short.
 */
export const ArmyLevel = ({ progress, rules }: { progress: ArmyProgressFacts; rules: ProgressionRulesFacts }) => {
  const reduced = useReducedMotion();
  const { into, needed } = levelProgress(progress, rules);
  const share = Math.min(100, (into / needed) * 100);
  const badge = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const shown = useRef({ level: progress.level, share });

  useEffect(() => {
    const previous = shown.current;
    shown.current = { level: progress.level, share };
    if (!bar.current || !badge.current) return;
    if (reduced) {
      bar.current.style.width = `${share}%`;
      return;
    }
    if (progress.level > previous.level) {
      const flash = animate(
        bar.current,
        { width: [`${previous.share}%`, "100%", "100%", `${share}%`], opacity: [1, 1, 0.4, 1] },
        { duration: LEVEL_UP_MS / 1000, times: [0, 0.35, 0.6, 1], ease: EASE.outQuart },
      );
      const pop = animate(badge.current, { scale: [1.25, 1] }, { duration: LEVEL_UP_MS / 1000, ease: EASE.outQuart });
      return () => {
        flash.stop();
        pop.stop();
      };
    }
    const fill = animate(bar.current, { width: `${share}%` }, { duration: FILL_MS / 1000, ease: EASE.outQuart });
    return () => fill.stop();
  }, [progress.level, reduced, share]);

  return (
    <span className="flex items-center gap-1.5" aria-label={`Level ${progress.level}, ${into} of ${needed} XP`}>
      <span
        ref={badge}
        className="inline-block rounded-full border border-gold/60 px-1.5 text-xs font-semibold text-gold tabular-nums"
      >
        L{progress.level}
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/50">
        <span ref={bar} className="block h-full rounded-full bg-[#b58cff]" style={{ width: `${share}%` }} />
      </span>
    </span>
  );
};
