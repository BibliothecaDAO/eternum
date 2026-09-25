import { AudioManager } from "@/audio/core/AudioManager";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { flashScreen, flySprites, fountainSprites, shakeScreen } from "@/ui/motion/motion-layer";
import { INTENSITY_LABEL } from "@/ui/motion/motion-scale";
import { playHaptic } from "@/ui/motion/motion-settings";
import { Pop } from "@/ui/motion/pop";
import { GOLD_COIN_ICON } from "@/ui/motion/gold-coin";
import { RarityChip } from "@/ui/motion/rarity-chip";
import { TickNumber } from "@/ui/motion/tick-number";
import { ResourcesIds } from "@bibliothecadao/types";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { AttributeOfferCard } from "../attributes/attribute-offer-card";
import {
  advanceChestMoment,
  type ChestResult,
  chestTimeline,
  closeChestMoment,
  skipChestMoment,
  useChestMoment,
} from "./chest-moment";

const TOKEN_ICON = `/images/resources/${ResourcesIds.Lords}.png`;
const SCRIM_OPACITY = 0.55;
const OPENING_CAPTION_AFTER_MS = 2_500;
const CARD_FAN_DELAY_MS = 280;
const CARD_STAGGER_MS = 80;
/** A LORDS result closes itself this long after its count settles; a relic waits for the player. */
const LORDS_DISMISS_AFTER_MS = 2_500;

/**
 * The chest moment's screen: the hold's vignette and caption, the rarity's tell and burst, then the LORDS or the relic.
 * Not a modal: the chest opens in the world and this sits over it. A tap anywhere skips the telling to its end, and a
 * tap once it has settled closes it.
 */
export const ChestMomentView = () => {
  const moment = useChestMoment();
  const settled = useRef(false);
  const markSettled = useCallback(() => {
    settled.current = true;
  }, []);
  usePacing();

  useEffect(() => {
    if (!moment) return;
    settled.current = false;
    const onTap = () => (settled.current ? closeChestMoment() : skipChestMoment());
    window.addEventListener("pointerdown", onTap);
    return () => window.removeEventListener("pointerdown", onTap);
  }, [moment?.openedAt]);

  const revealing = moment?.phase === "reveal";
  return (
    <AnimatePresence>
      {moment && (
        <motion.div
          key={moment.openedAt}
          className="pointer-events-none fixed inset-0 z-[55]"
          aria-live="polite"
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          {/* The hold's vignette, then the result's stage: the moment owns the screen while it shows. */}
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.45))]"
            animate={{ opacity: revealing ? 0 : 1 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: revealing ? SCRIM_OPACITY : 0 }}
            transition={{ duration: 0.2 }}
          />
          {moment.phase === "anticipation" && <OpeningCaption openedAt={moment.openedAt} at={moment.at} />}
          {revealing && moment.result && (
            <ChestReveal
              key={moment.skipped ? "final" : "telling"}
              result={moment.result}
              at={moment.at}
              speed={moment.speed}
              skipped={moment.skipped}
              onSettled={markSettled}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Moves the moment through its beats as each one's time runs out, playing each beat's sound, haptic and light once. */
const usePacing = () => {
  const moment = useChestMoment();
  const phase = moment?.phase;
  const hasResult = Boolean(moment?.result);
  // Each beat's sound, haptic and light play once per opening, however often its effect runs.
  const played = useRef<string | null>(null);
  const playOnce = (beat: string, play: () => void) => {
    const key = `${moment?.openedAt}:${beat}`;
    if (played.current === key) return;
    played.current = key;
    play();
  };
  useEffect(() => {
    if (!moment?.result || moment.skipped) return;
    const { intensity } = moment.result.outcome;
    const timeline = chestTimeline(intensity, moment.speed);
    if (phase === "anticipation") {
      const wait = Math.max(0, moment.openedAt + timeline.minAnticipationMs - performance.now());
      const id = window.setTimeout(() => advanceChestMoment("tell"), wait);
      return () => window.clearTimeout(id);
    }
    if (phase === "tell") {
      playOnce("tell", () => {
        void AudioManager.getInstance().play(`chest.tell.${INTENSITY_LABEL[intensity].toLowerCase()}`);
        playHaptic(intensity);
        if (timeline.shake) shakeScreen();
      });
      const id = window.setTimeout(() => advanceChestMoment("burst"), timeline.tellMs);
      return () => window.clearTimeout(id);
    }
    if (phase === "burst") {
      playOnce("burst", () => {
        void AudioManager.getInstance().play("chest.burst");
        if (timeline.flash) flashScreen();
      });
      const id = window.setTimeout(() => advanceChestMoment("reveal"), timeline.burstMs);
      return () => window.clearTimeout(id);
    }
    // The moment object changes on every beat; the beat and the result's arrival are what pace it.
  }, [phase, hasResult]);
};

const OpeningCaption = ({ openedAt, at }: { openedAt: number; at: { x: number; y: number } }) => {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(
      () => setLate(true),
      Math.max(0, openedAt + OPENING_CAPTION_AFTER_MS - performance.now()),
    );
    return () => window.clearTimeout(id);
  }, [openedAt]);
  if (!late) return null;
  return (
    <p className="absolute -translate-x-1/2 text-base text-gold/90" style={{ left: at.x, top: at.y + 36 }}>
      Opening…
    </p>
  );
};

const ChestReveal = ({
  result,
  at,
  speed,
  skipped,
  onSettled,
}: {
  result: ChestResult;
  at: { x: number; y: number };
  speed: number;
  skipped: boolean;
  onSettled: () => void;
}) => (
  <div className="absolute inset-x-0 top-[22%] flex flex-col items-center gap-3 px-4">
    {result.outcome.kind === "lords" ? (
      <LordsReveal
        lords={result.outcome.lords}
        intensity={result.outcome.intensity}
        at={at}
        speed={speed}
        skipped={skipped}
        onSettled={onSettled}
      />
    ) : (
      "relic" in result && <RelicReveal result={result} skipped={skipped} onSettled={onSettled} />
    )}
  </div>
);

/**
 * The card shows its rarity first. Gold coins fountain from the chest and up to 24 fly into the card's "+N LORDS", which
 * appears with the first landing, rolls up from zero and pulses on each landing after it: it never reads "+0".
 */
const LordsReveal = ({
  lords,
  intensity,
  at,
  speed,
  skipped,
  onSettled,
}: {
  lords: number;
  intensity: 0 | 1 | 2 | 3;
  at: { x: number; y: number };
  speed: number;
  skipped: boolean;
  onSettled: () => void;
}) => {
  const label = useRef<HTMLSpanElement>(null);
  const [landed, setLanded] = useState(skipped);
  const [nudge, setNudge] = useState(0);
  const started = useRef(false);

  // Once per reveal: the fountain and the flights start together and are never restarted.
  useEffect(() => {
    if (skipped || started.current || !label.current) return;
    started.current = true;
    const timeline = chestTimeline(intensity, speed);
    void AudioManager.getInstance().play("coin.shower");
    fountainSprites({ at, icon: GOLD_COIN_ICON, count: timeline.fountainCoins });
    flySprites({
      from: at,
      to: label.current,
      icon: GOLD_COIN_ICON,
      count: timeline.flyingCoins,
      speed,
      onArrive: (index) => {
        if (index === 0) {
          setLanded(true);
          void AudioManager.getInstance().play("resource.collect.lords");
        } else setNudge((count) => count + 1);
      },
    });
  }, [at, intensity, lords, skipped, speed]);

  // Settled once the count has landed on its amount; then it closes itself unless tapped first.
  useEffect(() => {
    if (!landed) return;
    onSettled();
    const id = window.setTimeout(closeChestMoment, LORDS_DISMISS_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [landed, onSettled]);

  return (
    <Pop className={cn(OVERLAY_SURFACE_BASE, "flex flex-col items-center gap-2 rounded-2xl px-6 py-4")}>
      {/* Laid out from the start, so the coins have somewhere to land, but hidden until the first one does. */}
      <span className={cn("flex items-center gap-2 text-3xl font-semibold text-gold", !landed && "invisible")}>
        <img src={TOKEN_ICON} alt="" className="h-8 w-8" />
        <span ref={label}>
          +<TickNumber value={landed ? lords : 0} nudge={nudge} speed={speed} />
        </span>
        LORDS
      </span>
      <RarityChip intensity={intensity} />
    </Pop>
  );
};

/**
 * The Loot item card rises with its rarity, then fans into the army's three offer cards. Under a LORDS roll the season
 * could not pay, a neutral ribbon says so: no red and no sting.
 */
const RelicReveal = ({
  result,
  skipped,
  onSettled,
}: {
  result: Extract<ChestResult, { relic: unknown }>;
  skipped: boolean;
  onSettled: () => void;
}) => {
  const started = useRef(false);
  useEffect(() => {
    onSettled();
    if (skipped || started.current) return;
    started.current = true;
    void AudioManager.getInstance().play("relic.chest");
    window.setTimeout(() => void AudioManager.getInstance().play("card.deal"), CARD_FAN_DELAY_MS);
  }, [onSettled, skipped]);

  const { outcome, relic } = result;
  return (
    <>
      {outcome.lordsSpent && (
        <Pop className={cn(OVERLAY_SURFACE_BASE, "rounded-full px-4 py-1.5 text-sm text-gold/90")}>
          Today's LORDS are spent. More at 00:00 UTC.
        </Pop>
      )}
      <Pop className={cn(OVERLAY_SURFACE_BASE, "flex flex-col items-center gap-2 rounded-2xl px-5 py-3 text-center")}>
        <h2 className="text-lg font-semibold text-gold">{relic.name}</h2>
        <RarityChip intensity={outcome.intensity} />
        <p className="text-sm text-gold/80">+{relic.offer.amount} to one of these</p>
      </Pop>
      <div className="flex justify-center gap-2">
        {relic.offer.choices.map((choice, index) => (
          <Pop key={choice.attribute} delayMs={skipped ? 0 : CARD_FAN_DELAY_MS + index * CARD_STAGGER_MS}>
            <span className="frontier-card block">
              <AttributeOfferCard attribute={choice.attribute} level={choice.level} amount={relic.offer.amount} />
            </span>
          </Pop>
        ))}
      </div>
    </>
  );
};
