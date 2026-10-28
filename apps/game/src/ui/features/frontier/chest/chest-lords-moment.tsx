import { AudioManager } from "@/audio/core/AudioManager";
import { useDocumentClass } from "@/hooks/use-document-class";
import type { ChestRarity } from "@/three/rewards/chest-rarity-glow";
import { CHEST_VEIL_SECONDS } from "@/three/rewards/reward-stage";
import {
  onRewardChestBeat,
  type RewardChestBeat,
  type RewardChestRequest,
} from "@/three/scenes/worldmap-reward-chest-request";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { EASE, type Intensity, POP_SPRING, tickDurationMs } from "@/ui/motion/motion-scale";
import { playHaptic } from "@/ui/motion/motion-settings";
import { TickNumber } from "@/ui/motion/tick-number";
import { formatExact, LORDS } from "@bibliothecadao/types";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** How long the LORDS take to count up once the lid opens: long enough to feel their weight. */
const LORDS_ROLL_MS = 1_300;

/** One staged chest's moment: its presentation, what it gives, and whether its lid has opened yet. */
type Moment = { id: number; request: RewardChestRequest; opened: boolean };

/**
 * A reward chest's moment around it, while the world map stages it over the board (RewardStage, which veils the board
 * under the chest): this veil darkens the HUD around it so the chest is the one thing to look at, and as the lid opens
 * its LORDS are the hero, counted up
 * large under it in front of light rays in its rarity, to Frontier's chest sounds; then the veil lifts as the chest
 * goes. It keeps no time of its own: it follows the chest's beats (shown, opened, ended) as the chest reaches them,
 * whatever the frame rate, and ends whenever the chest does, cancelled, replaced or left with the map. It takes no
 * pointer.
 */
export const ChestLordsMoment = () => {
  const [moment, setMoment] = useState<Moment | null>(null);
  useChestSounds();
  useEffect(() => {
    return onRewardChestBeat((beat) => setMoment((current) => followBeat(current, beat)));
  }, []);
  // Over the whole page, so it veils every HUD column and sheet, whatever stack the HUD draws them in.
  return createPortal(
    <AnimatePresence>
      {moment && <ChestMoment key={moment.id} request={moment.request} opened={moment.opened} />}
    </AnimatePresence>,
    document.body,
  );
};

/**
 * The moment as a chest's beat leaves it: a chest shown starts a fresh moment, in place of any before it; an opening
 * and an end belong to the chest they name, and a beat of a chest already replaced changes nothing.
 */
const followBeat = (current: Moment | null, { id, beat, request }: RewardChestBeat): Moment | null => {
  if (beat === "shown") return { id, request, opened: false };
  if (current?.id !== id) return current;
  return beat === "opened" ? { ...current, opened: true } : null;
};

const ChestMoment = ({ request, opened }: { request: RewardChestRequest; opened: boolean }) => {
  // The map's labels and plates step aside: nothing but the chest and its LORDS while it plays.
  useDocumentClass("chest-moment");
  return (
    <motion.div
      className="ui-chest-moment"
      data-chest-moment
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: CHEST_VEIL_SECONDS, ease: EASE.outQuart }}
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
 * Frontier's chest sounds on a staged chest's beats: its charge from the moment it is shown; as its lid opens the charge
 * stops and its rarity's tell, the burst and a shower of coins play, with a haptic; and the charge stops whenever the
 * chest ends. A chest shown in another's place stops the other's charge first.
 */
const useChestSounds = (): void => {
  useEffect(() => {
    const audio = AudioManager.getInstance();
    let current: { id: number; charge: Promise<AudioBufferSourceNode | null> } | null = null;
    const stopCharge = () => void current?.charge.then((source) => source && audio.stop(source));
    const stop = onRewardChestBeat(({ id, beat, request }) => {
      if (beat === "shown") {
        stopCharge();
        current = { id, charge: audio.play("chest.charge") };
        return;
      }
      if (current?.id !== id) return;
      stopCharge();
      if (beat === "opened") playOpening(audio, request.rarity);
      else current = null;
    });
    return () => {
      stop();
      stopCharge();
    };
  }, []);
};

const playOpening = (audio: AudioManager, rarity: ChestRarity): void => {
  void audio.play(`chest.tell.${TELLS[rarity]}`);
  void audio.play("chest.burst");
  void audio.play("coin.shower");
  playHaptic(intensityOf(rarity));
};

/** Each rarity's tell, as Frontier's chest sounds name them; a legendary chest tells as an epic one, the loudest. */
const TELLS: Record<ChestRarity, string> = { 1: "common", 2: "uncommon", 3: "rare", 4: "epic", 5: "epic" };

/** A chest's rarity on the moments' one scale: common to epic, a legendary chest at its top. */
const intensityOf = (rarity: ChestRarity): Intensity => Math.min(3, rarity - 1) as Intensity;
