import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { ResourcesIds } from "@bibliothecadao/types";
import { AnimatePresence, motion } from "framer-motion";
import { closeSiteClearCard, useSiteClearCard } from "./site-clear-moment";

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/**
 * The site-cleared card: compact, sliding up in the thumb zone rather than covering the world where the fight
 * happened. What the fight cost reads in neutral grey; what it paid reads large. A tap dismisses it early.
 */
export const SiteClearCardView = () => {
  const card = useSiteClearCard();
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {card && (
        <motion.button
          key={card.shownAt}
          type="button"
          onClick={closeSiteClearCard}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: 20, transition: { duration: 0.15 } }
          }
          transition={{ duration: 0.25, ease: EASE.outQuart }}
          className={cn(
            OVERLAY_SURFACE_BASE,
            "pointer-events-auto flex flex-col items-center gap-1 rounded-2xl px-5 py-3",
          )}
        >
          <span className="text-base font-semibold text-gold">{card.clear.title}</span>
          <span className="text-sm text-[#a9b0b8] tabular-nums">
            {card.troopsLost === undefined ? "—" : `−${whole.format(card.troopsLost)}`} troops
          </span>
          {card.clear.reward ? (
            <span className="flex items-center gap-2 text-2xl font-semibold text-gold tabular-nums">
              <ResourceIcon resource={ResourcesIds[card.clear.reward.resourceId]} size="md" withTooltip={false} />+
              {whole.format(card.clear.reward.amount)} {ResourcesIds[card.clear.reward.resourceId]}
            </span>
          ) : (
            card.clear.leavesChest && <span className="text-sm text-gold/90">Its chest waits on the tile.</span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
};
