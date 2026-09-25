import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
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
  MAX_ATTRIBUTE_LEVEL,
} from "./attributes";
import { closePick, commitPick, liftChoice, usePick } from "./pick-moment";

const DEAL_MS = 280;
const DEAL_STAGGER_MS = 60;
const FLY_MS = 450;
const FALL_MS = 200;

/**
 * The pick panel: the army's three offer cards dealt into the thumb zone. Its host places it just above the army's
 * card, so the chosen card is seen flying down into the badge. A tap lifts a card, "Choose" commits it, and
 * on the result the chosen card flies into the army's attribute badge while the others fall away. A refusal shakes the
 * card back with its reason. The offer is a fact: if it leaves the army's progress, the panel closes.
 */
export const PickPanel = ({
  progress,
  commit,
}: {
  progress: ArmyProgressFacts;
  commit: (attribute: Attribute) => Promise<void>;
}) => {
  const pick = usePick();
  const open = pick !== null && pick.explorerId === progress.explorer_id;
  const offerStands = progress.pending?.id === pick?.offer.id;

  // State first: an offer answered anywhere (or by a result that never reached this screen) takes the panel with it.
  useEffect(() => {
    if (open && !offerStands && pick?.phase !== "chosen") closePick();
  }, [offerStands, open, pick?.phase]);

  if (!open || !pick) return null;
  const busy = pick.phase === "committing" || pick.phase === "chosen";
  return (
    <section
      aria-label="Choose an attribute"
      className={cn(
        OVERLAY_SURFACE_BASE,
        "pointer-events-auto mx-auto flex w-full max-w-lg flex-col items-center gap-3 rounded-2xl p-3",
      )}
    >
      <h2 className="text-base font-semibold text-gold">
        +{pick.offer.amount} to one attribute{pick.offer.source === "Relic" ? " · relic" : ""}
      </h2>
      <div className="flex justify-center gap-2">
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
      {pick.error && <p className="text-sm text-gold/90">{pick.error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!pick.lifted || busy}
          onClick={() => commitPick(commit)}
          className="min-h-11 rounded-lg bg-gold px-5 font-semibold text-dark-brown disabled:opacity-40"
        >
          {pick.phase === "committing" ? "Choosing…" : "Choose"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={closePick}
          className="min-h-11 rounded-lg border border-gold/30 px-4 text-gold/80 disabled:opacity-40"
        >
          Later
        </button>
      </div>
    </section>
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
      className={cn("rounded-xl text-left", lifted && "ring-2 ring-gold")}
    >
      <AttributeOfferCard attribute={attribute} level={level} amount={amount} />
    </motion.button>
  );
};
