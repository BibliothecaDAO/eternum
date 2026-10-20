import { formatExact, LORDS } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { HudRarity, HudChip } from "@/ui/design-system/kit/hud-elements";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { RUIN, TROOPS, XP } from "@/ui/design-system/kit/words";
import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { motion } from "framer-motion";

/** The chest's glow grows with its tier: one intensity per step, common to legendary. */
const GLOW_PX: Record<Tier, number> = { 1: 0, 2: 12, 3: 22, 4: 34, 5: 48 };

/**
 * A ruin's chest opening in the clear's result (wireframe 07): over a scrim, the chest, the exact LORDS it pays (the
 * figure stored with it when it was found: its tier's shares at that day's price), its tier, the clear's XP and the
 * troops lost. No button: a tap anywhere goes on.
 */
export const RuinChestMoment = ({
  tier,
  lords,
  xp,
  troopsLost,
  onClose,
}: {
  tier: Tier;
  lords: number;
  xp: number | undefined;
  troopsLost: number;
  onClose: () => void;
}) => {
  const reduced = useReducedMotion();
  return (
    <button
      type="button"
      aria-label={RUIN}
      onClick={onClose}
      className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-hud-well"
    >
      <motion.span
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE.outQuart }}
        className="flex flex-col items-center gap-3"
      >
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
        <HudRarity tier={tier} word />
        <span className="flex items-center gap-2">
          {xp !== undefined && <HudChip>{`+${formatExact(xp)} ${XP}`}</HudChip>}
          <HudChip icons={["skull"]} label={TROOPS}>
            {`−${formatExact(troopsLost)}`}
          </HudChip>
        </span>
      </motion.span>
    </button>
  );
};
