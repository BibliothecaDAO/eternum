import { AudioManager } from "@/audio/core/AudioManager";
import { useDocumentClass } from "@/hooks/use-document-class";
import type { ChestRarity } from "@/three/rewards/chest-rarity-glow";
import { PRESENTED_CHEST_BEATS } from "@/three/rewards/chest-transitions";
import { onRewardChestShown, type RewardChestRequest } from "@/three/scenes/worldmap-reward-chest-request";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { EASE, type Intensity, POP_SPRING, tickDurationMs } from "@/ui/motion/motion-scale";
import { playHaptic } from "@/ui/motion/motion-settings";
import { TickNumber } from "@/ui/motion/tick-number";
import { formatExact, LORDS } from "@bibliothecadao/types";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** How long the LORDS take to count up once the lid opens: long enough to feel their weight. */
const LORDS_ROLL_MS = 1_300;
/** How long the veil takes to fall and to lift. */
const VEIL_SECONDS = 0.35;

/**
 * A reward chest's moment around it, while the world map stages it at the centre of the screen: the rest of the
 * screen darkens so the chest is the one thing to look at, and as the lid opens its LORDS are the hero, counted up
 * large under it in front of light rays in its rarity, to Frontier's chest sounds; then the veil lifts as the chest
 * goes. It plays on the chest's own clock, from the moment the world map shows it, and takes no pointer.
 */
export const ChestLordsMoment = () => {
  const [moment, setMoment] = useState<{ request: RewardChestRequest; shownAt: number } | null>(null);
  useEffect(() => {
    return onRewardChestShown((request) => setMoment({ request, shownAt: performance.now() }));
  }, []);
  // Over the whole page, so it veils every HUD column and sheet, whatever stack the HUD draws them in.
  return createPortal(
    <AnimatePresence>
      {moment && <ChestMoment key={moment.shownAt} request={moment.request} onDone={() => setMoment(null)} />}
    </AnimatePresence>,
    document.body,
  );
};

const ChestMoment = ({ request, onDone }: { request: RewardChestRequest; onDone: () => void }) => {
  // The map's labels and plates step aside: nothing but the chest and its LORDS while it plays.
  useDocumentClass("chest-moment");
  const opened = useChestOpened(request.rarity, onDone);
  return (
    <motion.div
      className="ui-chest-moment"
      data-chest-moment
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: VEIL_SECONDS, ease: EASE.outQuart }}
    >
      <div className="ui-chest-moment__veil" />
      {opened && <ChestWinnings request={request} />}
    </motion.div>
  );
};

/**
 * What the chest gives, popped in at the lid's opening: its LORDS the hero, counted up from nothing, large, before
 * light rays in its rarity; everything else small under them.
 */
const ChestWinnings = ({ request }: { request: RewardChestRequest }) => (
  <div className="ui-chest-moment__hero" data-tier={request.rarity}>
    <motion.div
      className="ui-chest-moment__pop"
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={POP_SPRING}
    >
      {request.lords > 0 && <LordsCount lords={request.lords} />}
      {request.prizes.length > 0 && (
        <span className="ui-chest-moment__prizes">
          {request.prizes.map((prize) => (
            <HudChip key={prize.name} icons={prize.icon ? [prize.icon] : undefined} label={prize.name}>
              {prize.figure}
            </HudChip>
          ))}
        </span>
      )}
    </motion.div>
  </div>
);

/** The LORDS, counted up from nothing with their weight. */
const LordsCount = ({ lords }: { lords: number }) => {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(lords);
  }, [lords]);
  return (
    <>
      <span className="ui-chest-moment__rays" />
      <span className="ui-chest-moment__figure" aria-label={`${formatExact(lords)} ${LORDS}`}>
        <SemanticIcon name="lords" size={96} />
        <TickNumber
          value={shown}
          speed={LORDS_ROLL_MS / tickDurationMs(lords, 1)}
          format={(amount) => `+${formatExact(Math.round(amount))}`}
        />
      </span>
      <span className="ui-chest-moment__word">{LORDS}</span>
    </>
  );
};

/**
 * The chest's beats, from the moment the world map shows it: its charge while it arrives, its rarity's tell and burst
 * as the lid opens (when this turns true), a shower of coins as its LORDS count, and the end as it goes.
 */
const useChestOpened = (rarity: ChestRarity, onDone: () => void): boolean => {
  const [opened, setOpened] = useState(false);
  // The beats run once per chest: a new onDone from a re-render never restarts them.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const audio = AudioManager.getInstance();
    const charge = audio.play("chest.charge");
    const at = (seconds: number, beat: () => void) => window.setTimeout(beat, seconds * 1_000);
    const timers = [
      at(PRESENTED_CHEST_BEATS.opens, () => {
        void charge.then((source) => source && audio.stop(source));
        void audio.play(`chest.tell.${TELLS[rarity]}`);
        void audio.play("chest.burst");
        void audio.play("coin.shower");
        playHaptic(intensityOf(rarity));
        setOpened(true);
      }),
      at(PRESENTED_CHEST_BEATS.gone - VEIL_SECONDS, () => done.current()),
    ];
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      void charge.then((source) => source && audio.stop(source));
    };
  }, [rarity]);
  return opened;
};

/** Each rarity's tell, as Frontier's chest sounds name them; a legendary chest tells as an epic one, the loudest. */
const TELLS: Record<ChestRarity, string> = { 1: "common", 2: "uncommon", 3: "rare", 4: "epic", 5: "epic" };

/** A chest's rarity on the moments' one scale: common to epic, a legendary chest at its top. */
const intensityOf = (rarity: ChestRarity): Intensity => Math.min(3, rarity - 1) as Intensity;
