import { AudioManager } from "@/audio/core/AudioManager";
import { getResourceSoundId } from "@/three/sound/utils";
import type { ResourcesIds } from "@bibliothecadao/types";
import { holdUntilLanding } from "../landing-hold";
import { flySprites } from "../motion-layer";

/**
 * Design §3.11 §4, the reveal yield. The icon of what a reveal paid pops on the revealed tile, flies to its banked
 * counter and the counter rolls as it lands; with no counter on screen it pops and rises where it was found. Chained
 * reveals climb a semitone each, up to seven, until three idle seconds reset the climb. Flights to one counter within a
 * second merge, and no more than six are in the air.
 */
const POP_MS = 200;
const MERGE_MS = 1_000;
const MAX_IN_AIR = 6;
const CHAIN_IDLE_MS = 3_000;
const MAX_CHAIN_SEMITONES = 7;
const RISE_PX = 48;
/** A landing always releases its counter, even if the flight never reports one. */
const RELEASE_AFTER_MS = 1_500;

let inAir = 0;
const lastFlightAt = new Map<string, number>();
let chain = { semitones: 0, at: Number.NEGATIVE_INFINITY };

/** The `data-fly-target` a resource's banked counter carries. */
export const bankedCounterTarget = (resourceId: ResourcesIds): string => `resource-${resourceId}`;

export const playRevealYield = ({
  resourceId,
  from,
  now = performance.now(),
}: {
  resourceId: ResourcesIds;
  /** The revealed tile on screen. */
  from: { x: number; y: number };
  now?: number;
}): void => {
  playChainedCollect(resourceId, now);
  flyToBankedCounter(resourceId, from, now);
};

const playChainedCollect = (resourceId: ResourcesIds, now: number) => {
  const semitones = now - chain.at > CHAIN_IDLE_MS ? 0 : Math.min(MAX_CHAIN_SEMITONES, chain.semitones + 1);
  chain = { semitones, at: now };
  void AudioManager.getInstance().play(getResourceSoundId(resourceId), { detuneCents: semitones * 100 });
};

const flyToBankedCounter = (resourceId: ResourcesIds, from: { x: number; y: number }, now: number) => {
  const target = bankedCounterTarget(resourceId);
  if (inAir >= MAX_IN_AIR || now - (lastFlightAt.get(target) ?? Number.NEGATIVE_INFINITY) < MERGE_MS) return;
  lastFlightAt.set(target, now);
  const counter = document.querySelector(`[data-fly-target="${target}"]`);
  const release = counter ? holdUntilLanding(target) : () => {};
  let landed = false;
  const land = () => {
    if (landed) return;
    landed = true;
    inAir -= 1;
    release();
  };
  inAir += 1;
  flySprites({
    from,
    to: counter ?? { x: from.x, y: from.y - RISE_PX },
    icon: `/images/resources/${resourceId}.png`,
    count: 1,
    popMs: POP_MS,
    onArrive: land,
  });
  setTimeout(land, RELEASE_AFTER_MS);
};
