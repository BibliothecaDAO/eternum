import { useReducedMotion } from "@/ui/motion/motion-settings";
import { motion } from "framer-motion";
import { type ArmyProgressFacts, bankedPicks, type ProgressionRulesFacts } from "./attributes";
import { CardFanGlyph } from "../glyphs";
import { openPick, usePick } from "./pick-moment";

/**
 * A waiting offer on its army (design §3.12, mockup 7): a pulsing fan of cards with the number of picks waiting, the
 * offer and those banked behind it. It opens the panel; never a forced modal.
 */
export const PickChip = ({ progress, rules }: { progress: ArmyProgressFacts; rules: ProgressionRulesFacts }) => {
  const pick = usePick();
  const reduced = useReducedMotion();
  const offer = progress.pending;
  if (!offer || pick?.explorerId === progress.explorer_id) return null;
  const waiting = 1 + bankedPicks(progress, rules);
  return (
    <motion.button
      type="button"
      aria-label={`Pick, ${waiting} waiting`}
      onClick={(event) => {
        event.stopPropagation();
        openPick(progress.explorer_id, offer);
      }}
      animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      className="pointer-events-auto relative flex size-11 items-center justify-center"
    >
      <CardFanGlyph className="size-9 drop-shadow-[0_0_8px_rgba(246,172,29,0.55)]" />
      <span className="absolute -right-0.5 top-0 flex size-5 items-center justify-center rounded-full bg-[#e39001] text-[11px] text-[#1b1207] tabular-nums">
        {waiting}
      </span>
    </motion.button>
  );
};
