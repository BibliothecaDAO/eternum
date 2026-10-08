import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { animate } from "framer-motion";
import { useEffect, useRef } from "react";
import {
  type ArmyProgressFacts,
  ATTRIBUTES,
  attributeBadgeTarget,
  attributeLevel,
  nextTierPrice,
  type ProgressionRulesFacts,
} from "./attributes";

const FILL_MS = 300;
const RING_RADIUS = 21;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** An army's diorama: its troops on their hex base. */
const armyArt = (troops: { category: string; tier: string }) =>
  `/images/armies/${troops.category.toLowerCase()}${troops.tier}.png`;

/** The cheapest Upgrade the army has left: what its ring fills toward; null once every attribute is legendary. */
const cheapestUpgrade = (progress: ArmyProgressFacts, rules: ProgressionRulesFacts): number | null =>
  ATTRIBUTES.map((attribute) => nextTierPrice(rules, attributeLevel(progress, attribute))).reduce<number | null>(
    (cheapest, price) => (price === null ? cheapest : cheapest === null ? price : Math.min(cheapest, price)),
    null,
  );

/**
 * An army's portrait (design §3.12, mockup 7): its diorama inside a ring that fills with XP toward its cheapest Upgrade,
 * and its XP as a badge. A chosen attribute card flies into it. The fill runs from effects on the fact's changes, so the
 * card's other re-renders (its countdown) never cut it short. Before the army's progress is known, the ring is empty
 * and no badge shows.
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
  const target = progress && rules ? cheapestUpgrade(progress, rules) : null;
  const share = progress && rules ? (target === null ? 1 : Math.min(1, progress.xp / target)) : 0;
  const arc = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const ring = arc.current;
    if (!ring) return;
    const offset = RING_LENGTH * (1 - share);
    if (reduced || !progress) {
      ring.style.strokeDashoffset = String(offset);
      return;
    }
    const fill = animate(ring, { strokeDashoffset: offset }, { duration: FILL_MS / 1000, ease: EASE.outQuart });
    return () => fill.stop();
  }, [progress, reduced, share]);

  return (
    <span
      data-fly-target={attributeBadgeTarget(explorerId)}
      aria-label={progress ? `${progress.xp} XP` : "XP unknown"}
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
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#1b1207] bg-[#dfaa54] px-1 text-[11px] text-[#1b1207] tabular-nums">
          {progress.xp}
        </span>
      )}
    </span>
  );
};
