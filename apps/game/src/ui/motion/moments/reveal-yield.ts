import { AudioManager } from "@/audio/core/AudioManager";
import { getResourceSoundId } from "@/three/sound/utils";
import type { ResourcesIds } from "@bibliothecadao/types";
import { holdUntilLanding } from "../landing-hold";
import { flySprites, riseSprite } from "../motion-layer";

/**
 * Design §3.11 §4, the reveal yield, one rule in every mode. The player's own reveal with its banked counter on screen
 * pops on the revealed tile and flies to the counter, which rolls as it lands; anything else (another player's reveal,
 * or no counter, as in Blitz) pops and rises on the tile with its amount. Only the player's own reveals sound, climbing
 * a semitone each, up to seven, until three idle seconds reset the climb. Flights to one counter within a second merge,
 * and no more than six are in the air.
 */
const POP_MS = 200;
const MERGE_MS = 1_000;
const MAX_IN_AIR = 6;
const CHAIN_IDLE_MS = 3_000;
const MAX_CHAIN_SEMITONES = 7;
/** A landing always releases its counter, even if the flight never reports one. */
const RELEASE_AFTER_MS = 1_500;

let inAir = 0;
const lastFlightAt = new Map<string, number>();
let chain = { semitones: 0, at: Number.NEGATIVE_INFINITY };

/** The `data-fly-target` a resource's banked counter carries. */
export const bankedCounterTarget = (resourceId: ResourcesIds): string => `resource-${resourceId}`;

const gain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export const playRevealYield = ({
  resourceId,
  amount,
  from,
  own,
  now = performance.now(),
}: {
  resourceId: ResourcesIds;
  /** What the reveal paid, in whole units. */
  amount: number;
  /** The revealed tile on screen. */
  from: { x: number; y: number };
  /** Whether the reveal paid one of this player's armies. */
  own: boolean;
  now?: number;
}): void => {
  if (own) playChainedCollect(resourceId, now);
  const counter = own ? document.querySelector(`[data-fly-target="${bankedCounterTarget(resourceId)}"]`) : null;
  if (counter) flyToBankedCounter(resourceId, counter, from, now);
  else riseSprite({ at: from, icon: resourceIcon(resourceId), label: `+${gain.format(amount)}` });
};

const resourceIcon = (resourceId: ResourcesIds) => `/images/resources/${resourceId}.png`;

const playChainedCollect = (resourceId: ResourcesIds, now: number) => {
  const semitones = now - chain.at > CHAIN_IDLE_MS ? 0 : Math.min(MAX_CHAIN_SEMITONES, chain.semitones + 1);
  chain = { semitones, at: now };
  void AudioManager.getInstance().play(getResourceSoundId(resourceId), { detuneCents: semitones * 100 });
};

const flyToBankedCounter = (
  resourceId: ResourcesIds,
  counter: Element,
  from: { x: number; y: number },
  now: number,
) => {
  const target = bankedCounterTarget(resourceId);
  if (inAir >= MAX_IN_AIR || now - (lastFlightAt.get(target) ?? Number.NEGATIVE_INFINITY) < MERGE_MS) return;
  lastFlightAt.set(target, now);
  const release = holdUntilLanding(target);
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
    to: counter,
    icon: resourceIcon(resourceId),
    count: 1,
    popMs: POP_MS,
    onArrive: land,
  });
  setTimeout(land, RELEASE_AFTER_MS);
};
