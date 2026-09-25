import { Sparkles } from "@/ui/design-system/atoms/game-icons";
import { toast } from "@/ui/features/event-feed/notify";
import { EASE } from "@/ui/motion/motion-scale";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { animate, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { AttributeOfferCard } from "./attribute-offer-card";
import {
  type ArmyProgressFacts,
  type Attribute,
  attributeBadgeTarget,
  attributeLevel,
  levelProgress,
  MAX_ATTRIBUTE_LEVEL,
  type ProgressionRulesFacts,
} from "./attributes";
import { closePick, commitPick, liftChoice, usePick } from "./pick-moment";

const DEAL_MS = 280;
const DEAL_STAGGER_MS = 60;
const FLY_MS = 450;
const FALL_MS = 200;

/**
 * The pick panel (mockup 6): the army's level and its bar, then its three offer cards dealt into the thumb zone. Its
 * host places it just above the army's card, so the chosen card is seen flying down into the army's portrait. A tap
 * lifts a card, Choose commits it, and on the result the chosen card flies home while the others fall away. A refusal
 * shakes the card back and says why in a toast. The handle puts the pick off. The offer is a fact: if it leaves the
 * army's progress, the panel closes.
 */
export const PickPanel = ({
  progress,
  rules,
  commit,
}: {
  progress: ArmyProgressFacts;
  rules: ProgressionRulesFacts;
  commit: (attribute: Attribute) => Promise<void>;
}) => {
  const pick = usePick();
  const open = pick !== null && pick.explorerId === progress.explorer_id;
  const offerStands = progress.pending?.id === pick?.offer.id;

  // State first: an offer answered anywhere (or by a result that never reached this screen) takes the panel with it.
  useEffect(() => {
    if (open && !offerStands && pick?.phase !== "chosen") closePick();
  }, [offerStands, open, pick?.phase]);

  useEffect(() => {
    if (pick?.error) toast.error(pick.error);
  }, [pick?.error]);

  if (!open || !pick) return null;
  const busy = pick.phase === "committing" || pick.phase === "chosen";
  return (
    <section
      aria-label="Choose an attribute"
      className="frontier-card pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3 p-3 font-sans"
    >
      <button
        type="button"
        aria-label="Later"
        disabled={busy}
        onClick={closePick}
        className="-mt-1 flex h-5 justify-center"
      >
        <span className="frontier-handle" />
      </button>
      <LevelBar progress={progress} rules={rules} relic={pick.offer.source === "Relic"} />
      <div className="grid grid-cols-3 gap-2">
        {pick.offer.choices.map((attribute, index) => (
          <DealtCard
            key={attribute}
            index={index}
            attribute={attribute}
            level={attributeLevel(progress, attribute)}
            amount={pick.offer.amount}
            lifted={pick.lifted === attribute}
            phase={pick.phase}
            badge={attributeBadgeTarget(progress.explorer_id)}
            onLift={() => liftChoice(attribute)}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={!pick.lifted || busy}
        onClick={() => commitPick(commit)}
        className="frontier-primary w-full"
      >
        Choose
      </button>
    </section>
  );
};

/** The army's level in its ring and how far into it the army is; a relic's offer wears the relic mark. */
const LevelBar = ({
  progress,
  rules,
  relic,
}: {
  progress: ArmyProgressFacts;
  rules: ProgressionRulesFacts;
  relic: boolean;
}) => {
  const { into, needed } = levelProgress(progress, rules);
  return (
    <span className="flex items-center gap-3" aria-label={`Level ${progress.level}`}>
      <span className="frontier-title flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[#dfaa54] tabular-nums">
        {progress.level}
      </span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#dfaa54]/15">
        <span
          className="block h-full rounded-full bg-[linear-gradient(90deg,#f7c35a,#e39001)]"
          style={{ width: `${needed > 0 ? (into / needed) * 100 : 100}%` }}
        />
      </span>
      {relic && <Sparkles className="size-7" alt="Relic" />}
    </span>
  );
};

/** One card: dealt in from below, lifted on its tap, and on the result either flown home or dropped. */
const DealtCard = ({
  index,
  attribute,
  level,
  amount,
  lifted,
  phase,
  badge,
  onLift,
}: {
  index: number;
  attribute: Attribute;
  level: number;
  amount: number;
  lifted: boolean;
  phase: string;
  badge: string;
  onLift: () => void;
}) => {
  const reduced = useReducedMotion();
  const card = useRef<HTMLButtonElement>(null);

  // The result: the chosen card flies into the badge, the others fall away; then the panel closes.
  useEffect(() => {
    const element = card.current;
    if (phase !== "chosen" || !element) return;
    if (!lifted) {
      void animate(element, { y: 60, opacity: 0 }, { duration: reduced ? 0 : FALL_MS / 1000, ease: EASE.inCubic });
      return;
    }
    const target = document.querySelector(`[data-fly-target="${badge}"]`)?.getBoundingClientRect();
    const from = element.getBoundingClientRect();
    const flight =
      target && !reduced
        ? animate(
            element,
            {
              x: target.left + target.width / 2 - (from.left + from.width / 2),
              y: target.top + target.height / 2 - (from.top + from.height / 2),
              scale: 0.2,
              opacity: 0.3,
            },
            { duration: FLY_MS / 1000, ease: EASE.inCubic },
          )
        : undefined;
    const id = window.setTimeout(closePick, reduced || !target ? 0 : FLY_MS);
    return () => {
      flight?.stop();
      window.clearTimeout(id);
    };
  }, [badge, lifted, phase, reduced]);

  // A refusal: the lifted card shakes back into place.
  useEffect(() => {
    if (phase !== "failed" || !lifted || !card.current || reduced) return;
    const shake = animate(card.current, { x: [0, -8, 8, -6, 6, 0] }, { duration: 0.3 });
    return () => shake.stop();
  }, [lifted, phase, reduced]);

  return (
    <motion.button
      ref={card}
      type="button"
      aria-pressed={lifted}
      aria-label={`${attribute}, level ${level} to ${Math.min(MAX_ATTRIBUTE_LEVEL, level + amount)}`}
      onClick={onLift}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 60 }}
      // Once chosen, the flight or the fall owns the card.
      animate={phase === "chosen" ? undefined : { opacity: 1, y: lifted ? -8 : 0, scale: lifted ? 1.05 : 1 }}
      transition={{ duration: DEAL_MS / 1000, delay: (index * DEAL_STAGGER_MS) / 1000, ease: EASE.outQuart }}
      className="frontier-card"
    >
      <AttributeOfferCard attribute={attribute} level={level} amount={amount} />
    </motion.button>
  );
};
