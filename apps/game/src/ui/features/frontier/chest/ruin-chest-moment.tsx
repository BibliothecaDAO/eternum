import { formatExact } from "@/ui/design-system/kit/amount";
import { Chip } from "@/ui/design-system/kit/chip";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { type Tier, TierChip } from "@/ui/design-system/kit/tier-chip";
import { LORDS, RUIN, TROOPS, XP } from "@/ui/design-system/kit/words";
import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { motion } from "framer-motion";

/** The chest's glow grows with its tier: one intensity per step, common to legendary. */
const GLOW_PX: Record<Tier, number> = { 1: 0, 2: 12, 3: 22, 4: 34, 5: 48 };

/**
 * A ruin's chest opening in the clear's result (wireframe 07): over a scrim, the chest, the exact LORDS it pays (the
 * figure stored with it when it was found), its tier, the clear's XP and the troops lost. No button: a tap anywhere
 * goes on.
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
      className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80"
    >
      <motion.span
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE.outQuart }}
        className="flex flex-col items-center gap-3"
      >
        <span
          className="rounded-3xl"
          style={{ boxShadow: GLOW_PX[tier] ? `0 0 ${GLOW_PX[tier]}px var(--frontier-hot)` : undefined }}
        >
          <KitIcon code="Ch" size={132} />
        </span>
        <span className="flex items-center gap-2" aria-label={`${formatExact(lords)} ${LORDS}`}>
          <KitIcon code="Lo" size={34} />
          <span className="text-[44px] leading-none tabular-nums text-[color:var(--frontier-gold2)]">
            +{formatExact(lords)}
          </span>
        </span>
        <TierChip tier={tier} showWord />
        <span className="flex items-center gap-2">
          {xp !== undefined && <Chip icons={[]} label={XP} value={`+${formatExact(xp)}`} unit={XP} />}
          <Chip icons={["Sk"]} label={TROOPS} value={`−${formatExact(troopsLost)}`} />
        </span>
      </motion.span>
    </button>
  );
};
