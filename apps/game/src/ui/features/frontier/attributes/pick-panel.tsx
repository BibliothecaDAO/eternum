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
  ATTRIBUTES,
  attributeBadgeTarget,
  attributeLevel,
  MAX_ATTRIBUTE_LEVEL,
  nextTierPrice,
  type ProgressionRulesFacts,
} from "./attributes";
import { SheetClose, useEscapeCloses } from "../frontier-sheet";
import { closePick, commitPick, liftChoice, usePick } from "./pick-moment";

const DEAL_MS = 280;
const DEAL_STAGGER_MS = 60;
const FLY_MS = 450;
const FALL_MS = 200;

/**
 * The Upgrade panel: the army's XP, then its four attributes dealt into the thumb zone, each priced at its next tier and
 * lit only while the army can pay. Its host places it just above the army's card, so the chosen card is seen flying down
 * into the army's portrait. A tap lifts a card, Choose commits it, and on the result the chosen card flies home while the
 * others fall away. A refusal shakes the card back and says why in a toast.
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

  useEffect(() => {
    if (pick?.error) toast.error(pick.error);
  }, [pick?.error]);

  useEscapeCloses(closePick);
  if (!open || !pick) return null;
  const busy = pick.phase === "committing" || pick.phase === "chosen";
  return (
    <section
      aria-label="Choose an attribute"
      className="frontier-card pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-3 p-3 font-sans"
    >
      <div className="-mb-2 flex justify-end">
        <SheetClose label="Later" disabled={busy} onClose={closePick} />
      </div>
      <XpBalance progress={progress} />
      <div className="grid grid-cols-4 gap-2">
        {ATTRIBUTES.map((attribute, index) => {
          const level = attributeLevel(progress, attribute);
          const price = nextTierPrice(rules, level);
          return (
            <DealtCard
              key={attribute}
              index={index}
              attribute={attribute}
              level={level}
              price={price}
              affordable={price !== null && progress.xp >= price}
              lifted={pick.lifted === attribute}
              phase={pick.phase}
              badge={attributeBadgeTarget(progress.explorer_id)}
              onLift={() => liftChoice(attribute)}
            />
          );
        })}
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

/** The army's unspent XP, what every Upgrade is paid from. */
const XpBalance = ({ progress }: { progress: ArmyProgressFacts }) => (
  <span className="flex items-center justify-center gap-2" aria-label={`${progress.xp} XP`}>
    <Sparkles className="size-6" alt="" />
    <span className="frontier-title tabular-nums">{progress.xp} XP</span>
  </span>
);

/** One card: dealt in from below, lifted on its tap, and on the result either flown home or dropped. */
const DealtCard = ({
  index,
  attribute,
  level,
  price,
  affordable,
  lifted,
  phase,
  badge,
  onLift,
}: {
  index: number;
  attribute: Attribute;
  level: number;
  price: number | null;
  affordable: boolean;
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
      aria-label={`${attribute}, tier ${level} to ${Math.min(MAX_ATTRIBUTE_LEVEL, level + 1)}`}
      disabled={!affordable}
      onClick={onLift}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 60 }}
      // Once chosen, the flight or the fall owns the card.
      animate={phase === "chosen" ? undefined : { opacity: 1, y: lifted ? -8 : 0, scale: lifted ? 1.05 : 1 }}
      transition={{ duration: DEAL_MS / 1000, delay: (index * DEAL_STAGGER_MS) / 1000, ease: EASE.outQuart }}
      className="frontier-card"
    >
      <AttributeOfferCard attribute={attribute} level={level} amount={price === null ? 0 : 1} price={price} />
    </motion.button>
  );
};
