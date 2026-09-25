import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { type ArmyProgressFacts, attributeBadgeTarget, levelProgress, type ProgressionRulesFacts } from "./attributes";

const FILL_MS = 300;
const LEVEL_UP_MS = 400;
const RING_RADIUS = 21;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** An army's diorama: its troops on their hex base. */
const armyArt = (troops: { category: string; tier: string }) =>
  `/images/armies/${troops.category.toLowerCase()}${troops.tier}.png`;

/**
 * An army's portrait (design §3.12, mockup 7): its diorama inside a ring that fills with XP toward the next level,
 * and the level as a badge. A chosen attribute card flies into it. On a level-up the ring flashes full before the
 * new level's fill and the badge pops; the motion runs from effects on the fact's changes, so the card's other
 * re-renders (its countdown) never cut it short. Before the army's progress is known, the ring is empty and no badge
 * shows.
 */
export const ArmyPortrait = ({
  explorerId,
  troops,
  progress,
  rules,
}: {
  explorerId: number;
  troops: { category: string; tier: string };
  progress: ArmyProgressFacts | undefined;
  rules: ProgressionRulesFacts | undefined;
}) => {
  const reduced = useReducedMotion();
  const level = progress && rules ? levelProgress(progress, rules) : null;
  const share = level ? Math.min(1, level.into / level.needed) : 0;
  const arc = useRef<SVGCircleElement>(null);
  const badge = useRef<HTMLSpanElement>(null);
  const shown = useRef({ level: progress?.level ?? 0, share });

  useEffect(() => {
    const previous = shown.current;
    shown.current = { level: progress?.level ?? 0, share };
    const ring = arc.current;
    if (!ring) return;
    const offset = (fill: number) => RING_LENGTH * (1 - fill);
    if (reduced || !progress) {
      ring.style.strokeDashoffset = String(offset(share));
      return;
    }
    if (progress.level > previous.level && badge.current) {
      const flash = animate(
        ring,
        { strokeDashoffset: [offset(previous.share), offset(1), offset(1), offset(share)] },
        { duration: LEVEL_UP_MS / 1000, times: [0, 0.35, 0.6, 1], ease: EASE.outQuart },
      );
      const pop = animate(badge.current, { scale: [1.35, 1] }, { duration: LEVEL_UP_MS / 1000, ease: EASE.outQuart });
      return () => {
        flash.stop();
        pop.stop();
      };
    }
    const fill = animate(ring, { strokeDashoffset: offset(share) }, { duration: FILL_MS / 1000, ease: EASE.outQuart });
    return () => fill.stop();
  }, [progress, reduced, share]);

  return (
    <span
      data-fly-target={attributeBadgeTarget(explorerId)}
      aria-label={progress && level ? `Level ${progress.level}, ${level.into} of ${level.needed} XP` : "Level unknown"}
      className="relative block size-12 shrink-0"
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={RING_RADIUS} fill="none" stroke="rgba(223,170,84,0.25)" strokeWidth="3" />
        <circle
          ref={arc}
          cx="24"
          cy="24"
          r={RING_RADIUS}
          fill="none"
          stroke="#dfaa54"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          style={{ strokeDashoffset: RING_LENGTH * (1 - share) }}
        />
      </svg>
      <span className="absolute inset-[5px] overflow-hidden rounded-full bg-black/60">
        <img src={armyArt(troops)} alt="" className="size-full object-cover" />
      </span>
      {progress && (
        <span
          ref={badge}
          className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border border-[#1b1207] bg-[#dfaa54] text-[11px] text-[#1b1207] tabular-nums"
        >
          {progress.level}
        </span>
      )}
    </span>
  );
};
