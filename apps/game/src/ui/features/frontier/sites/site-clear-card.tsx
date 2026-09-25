import { Skull, TreasureChest } from "@/ui/design-system/atoms/game-icons";
import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { AnimatePresence, motion } from "framer-motion";
import { Chip } from "../frontier-chips";
import { formatAmount } from "../frontier-format";
import { FlagGlyph } from "../glyphs";
import { SITE_ART } from "./site-art";
import { closeSiteClearCard, useSiteClearCard } from "./site-clear-moment";

/**
 * The site-cleared card (mockup 6): compact, sliding up in the thumb zone rather than covering the world where the
 * fight happened. The site's art carries its taken flag; what it paid reads large, a fallen realm's chest in its
 * place; what the fight cost is a small skull chip. No words. A tap dismisses it early.
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
          aria-label="Site cleared"
          onClick={closeSiteClearCard}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: 20, transition: { duration: 0.15 } }
          }
          transition={{ duration: 0.25, ease: EASE.outQuart }}
          className="frontier-card pointer-events-auto flex w-full items-center gap-4 p-3"
        >
          <span className="relative size-28 shrink-0 overflow-hidden rounded-xl bg-black/50">
            <img src={SITE_ART[card.clear.kind]} alt="" className="size-full object-cover" />
            <FlagGlyph className="absolute bottom-1 right-1 size-9" />
          </span>
          <span className="flex flex-col items-start gap-2">
            {card.clear.reward ? (
              <span className="flex items-center gap-2" aria-label={`Paid ${formatAmount(card.clear.reward.amount)}`}>
                <img src={`/images/resources/${card.clear.reward.resourceId}.png`} alt="" className="size-12" />
                <span className="frontier-hero text-[44px] leading-none tabular-nums">
                  +{formatAmount(card.clear.reward.amount)}
                </span>
              </span>
            ) : (
              <TreasureChest className="size-16" alt="Its chest waits on the tile" />
            )}
            <Chip label="Troops lost" icon={<Skull />} value={`−${formatAmount(card.troopsLost)}`} />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
