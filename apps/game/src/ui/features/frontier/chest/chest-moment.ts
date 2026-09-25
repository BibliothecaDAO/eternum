import { AudioManager } from "@/audio/core/AudioManager";
import { finishFlights } from "@/ui/motion/motion-layer";
import { INTENSITY, type Intensity, momentSpeed } from "@/ui/motion/motion-scale";
import { create } from "zustand";
import type { ChestBeat } from "@/three/rewards/chest-opening-beats";
import type { ChestOutcome } from "./chest-outcome";
import type { Attribute } from "../attributes/attributes";

/**
 * Design §3.11 §1, the chest: tap, anticipation until the result arrives, the rarity's tell, the burst, then the LORDS
 * or the relic. One moment at a time lives here; the HUD overlay and the world's chest both play from this state, so
 * nothing is timed twice. The facts decide the result; this only paces its telling.
 */
type ChestPhase = "anticipation" | "tell" | "burst" | "reveal";

/** A relic's pending attribute offer as its cards show it: each choice with the army's level in it now. */
export interface RelicOffer {
  amount: number;
  choices: readonly { attribute: Attribute; level: number }[];
}

export type ChestResult =
  | { outcome: Extract<ChestOutcome, { kind: "lords" }> }
  | { outcome: Extract<ChestOutcome, { kind: "relic" }>; relic: { name: string; offer: RelicOffer } };

interface ChestMoment {
  /** The chest on screen, where the tap landed and the reveal rises from. */
  at: { x: number; y: number };
  openedAt: number;
  phase: ChestPhase;
  result: ChestResult | null;
  /** The repeat speed, fixed when the result arrives: an epic always plays in full. */
  speed: number;
  tellAt: number | null;
  /** Skipped to its end: the reveal shows its final state at once. */
  skipped: boolean;
}

const useChestMomentStore = create<{ moment: ChestMoment | null }>(() => ({ moment: null }));

export const useChestMoment = () => useChestMomentStore((state) => state.moment);

/** The moment as the world's chest plays it each frame; null when no chest is opening. */
export const readChestBeat = (): ChestBeat | null => {
  const moment = current();
  return moment
    ? {
        phase: moment.phase,
        intensity: moment.result?.outcome.intensity ?? null,
        openedAt: moment.openedAt,
        tellAt: moment.tellAt,
      }
    : null;
};

const set = (moment: ChestMoment | null) => useChestMomentStore.setState({ moment });
const current = () => useChestMomentStore.getState().moment;

let charge: Promise<AudioBufferSourceNode | null> | null = null;

const OFF_CENTRE_SHARE = 0.2;

/**
 * Whether the camera should fly to a point (design §3.11): only when it sits more than 20% of the view off-centre, so a
 * chest already in view never moves the map.
 */
export const isOffCentre = (at: { x: number; y: number }, view: { width: number; height: number }): boolean =>
  Math.abs(at.x - view.width / 2) > view.width * OFF_CENTRE_SHARE ||
  Math.abs(at.y - view.height / 2) > view.height * OFF_CENTRE_SHARE;

/**
 * The player tapped a closed chest: the hold starts and lasts until the result arrives, hiding the transaction. The
 * camera flies to the chest (the scene's `focus`, 400 ms) only when it sits off-centre.
 */
export const beginChestOpening = (
  at: { x: number; y: number },
  { focus, now = performance.now() }: { focus?: () => void; now?: number } = {},
): void => {
  if (focus && isOffCentre(at, { width: window.innerWidth, height: window.innerHeight })) focus();
  void AudioManager.getInstance().play("chest.tap");
  charge = AudioManager.getInstance().play("chest.charge");
  set({ at, openedAt: now, phase: "anticipation", result: null, speed: 1, tellAt: null, skipped: false });
};

/** The result arrived (Herald's pre-confirmed chest story): the hold ends once its minimum has passed. */
export const resolveChestOpening = (result: ChestResult, now = performance.now()): void => {
  const moment = current();
  if (!moment || moment.result) return;
  set({ ...moment, result, speed: momentSpeed("chest", result.outcome.intensity, now) });
};

/** The opening failed: the hold ends where it is, and the caller says why. */
export const cancelChestOpening = (): void => {
  stopCharge();
  set(null);
};

/** Moves the moment to its next beat; the overlay calls this as each beat's time runs out. */
export const advanceChestMoment = (phase: Exclude<ChestPhase, "anticipation">, now = performance.now()): void => {
  const moment = current();
  if (!moment?.result) return;
  if (phase === "tell") stopCharge();
  set({ ...moment, phase, tellAt: phase === "tell" ? now : moment.tellAt });
};

/** A tap anywhere during the telling jumps to the result: landings complete, cards shown. */
export const skipChestMoment = (now = performance.now()): void => {
  const moment = current();
  if (!moment || !canSkipChestMoment(moment, now)) return;
  stopCharge();
  finishFlights();
  set({ ...moment, phase: "reveal", tellAt: moment.tellAt ?? now, skipped: true });
};

export const closeChestMoment = (): void => {
  stopCharge();
  set(null);
};

const stopCharge = () => {
  const playing = charge;
  charge = null;
  void playing?.then((source) => source && AudioManager.getInstance().stop(source));
};

const EPIC_SKIPPABLE_AFTER_MS = 400;

/** Skippable once there is a result to jump to; an epic only after it has had 400 ms of its tell. */
export const canSkipChestMoment = (moment: Pick<ChestMoment, "result" | "tellAt">, now: number): boolean => {
  if (!moment.result) return false;
  if (moment.result.outcome.intensity < 3) return true;
  return moment.tellAt !== null && now - moment.tellAt >= EPIC_SKIPPABLE_AFTER_MS;
};

const FOUNTAIN_COINS = [8, 16, 32, 64] as const;
const MAX_FLYING_COINS = 24;

/**
 * How long each beat lasts and how big it plays, from the rarity and the repeat speed: holds shorten to 250 ms and the
 * fountain halves on a repeat, while an epic always plays in full.
 */
export const chestTimeline = (intensity: Intensity, speed: number) => {
  const fountain = Math.round(FOUNTAIN_COINS[intensity] * speed);
  return {
    minAnticipationMs: speed < 1 ? 250 : 600,
    tellMs: (250 + INTENSITY.extraHoldMs[intensity]) * speed,
    burstMs: 300 * speed,
    fountainCoins: fountain,
    flyingCoins: Math.min(MAX_FLYING_COINS, fountain),
    shake: intensity === 3,
    flash: INTENSITY.flash[intensity],
    beam: INTENSITY.beam[intensity],
  };
};
