import { useReducedMotion } from "@/ui/motion/motion-settings";
import { motion } from "framer-motion";
import { type ArmyProgressFacts, bankedPicks, type ProgressionRulesFacts } from "./attributes";
import { openPick, usePick } from "./pick-moment";

/**
 * A waiting offer on its army: a pulsing "Pick" chip that opens the panel, with "+N" when more picks are banked behind
 * it. Never a forced modal.
 */
export const PickChip = ({ progress, rules }: { progress: ArmyProgressFacts; rules: ProgressionRulesFacts }) => {
  const pick = usePick();
  const reduced = useReducedMotion();
  const offer = progress.pending;
  if (!offer || pick?.explorerId === progress.explorer_id) return null;
  const behind = bankedPicks(progress, rules);
  return (
    <motion.button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        openPick(progress.explorer_id, offer);
      }}
      animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      className="pointer-events-auto min-h-8 rounded-full bg-gold px-3 text-sm font-semibold text-dark-brown"
    >
      Pick
      {behind > 0 && <span className="ml-1 text-xs font-bold">+{behind}</span>}
    </motion.button>
  );
};
