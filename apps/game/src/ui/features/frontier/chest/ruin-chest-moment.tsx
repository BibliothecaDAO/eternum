import { formatExact, LORDS, formatShort } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { HudRarity, HudChip } from "@/ui/design-system/kit/hud-elements";
import { type Tier, TROOPS, XP } from "@/ui/design-system/kit/words";
import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { motion } from "framer-motion";
import { useEffect } from "react";

/** The chest's glow grows with its tier: one intensity per step, common to legendary. */
const GLOW_PX: Record<Tier, number> = { 1: 0, 2: 12, 3: 22, 4: 34, 5: 48 };

/** How long the chest stands once it has risen: long enough to read what it paid, too short to wait on. */
export const RUIN_CHEST_SHOWN_MS = 2_400;

/**
 * A ruin's chest opening, the clear's flourish (wireframe 07): the chest, the exact LORDS it pays (the figure stored
 * with it when it was found: its tier's shares at that day's price), its tier, the clear's XP and the troops lost. It
 * rises, stands and goes by itself, over the map without holding it: nothing to press, every click goes through to the
 * map (owner, 28 October 2026: "the animation should autoplay and autocloses"). What the clear did stays in the Feed.
 */
export const RuinChestMoment = ({
  tier,
  lords,
  xp,
  troopsLost,
  onDone,
}: {
  tier: Tier;
  lords: number;
  xp: number | undefined;
  troopsLost: number;
  onDone: () => void;
}) => {
  const reduced = useReducedMotion();
  useEffect(() => {
    const timer = window.setTimeout(onDone, RUIN_CHEST_SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (
    <motion.div
      role="status"
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -16 }}
      transition={{ duration: 0.45, ease: EASE.outQuart }}
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Its own well, so its numbers read over any ground without darkening the map around it. */}
      <span className="flex flex-col items-center gap-3 rounded-3xl bg-hud-well px-8 py-6">
        <span
          className="rounded-3xl"
          style={{ boxShadow: GLOW_PX[tier] ? `0 0 ${GLOW_PX[tier]}px var(--hud-warn)` : undefined }}
        >
          <SemanticIcon name="chest" size={132} />
        </span>
        <span className="flex items-center gap-2" aria-label={`${formatExact(lords)} ${LORDS}`}>
          <SemanticIcon name="lords" size={34} />
          <span className="text-hud-display tabular-nums text-hud-gold">+{formatExact(lords)}</span>
        </span>
        <HudRarity tier={tier} />
        <span className="flex items-center gap-2">
          {xp !== undefined && <HudChip>{`${formatShort(xp, { signed: true })} ${XP}`}</HudChip>}
          <HudChip icons={["skull"]} label={TROOPS}>
            {`−${formatShort(troopsLost)}`}
          </HudChip>
        </span>
      </span>
    </motion.div>
  );
};
