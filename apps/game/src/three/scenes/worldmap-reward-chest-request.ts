import type { ChestPrize } from "../rewards/chest-reward-reveal";
import type { ChestRarity } from "../rewards/chest-rarity-glow";
import type { ChestPresentationBeats } from "../rewards/chest-transitions";

/** The HUD asks the world map to stage a reward's chest at the screen's centre: it arrives, opens and goes by itself. */
const REWARD_CHEST_REQUEST_EVENT = "rewardChestRequest";
/** The staged chest's beats, as the chest itself reaches them: whatever plays beside it follows these and nothing else. */
const REWARD_CHEST_BEAT_EVENT = "rewardChestBeat";

export interface RewardChestRequest {
  /** What else it gives, shown small under the LORDS: the clear's XP and the troops lost. */
  prizes: readonly ChestPrize[];
  rarity: ChestRarity;
  /** The LORDS the chest pays: the moment's hero, counted up at the centre of the screen. */
  lords: number;
}

/** One beat of one staged chest: `id` names the presentation, so a beat of one it replaced is told apart. */
export interface RewardChestBeat {
  id: number;
  beat: "shown" | "opened" | "ended";
  request: RewardChestRequest;
}

export const requestRewardChest = (request: RewardChestRequest): void => {
  window.dispatchEvent(new CustomEvent(REWARD_CHEST_REQUEST_EVENT, { detail: request }));
};

export const onRewardChestRequest = (handle: (request: RewardChestRequest) => void): (() => void) => {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<Partial<RewardChestRequest>>).detail;
    if (!isRequest(detail)) return;
    handle({ prizes: detail.prizes, rarity: detail.rarity, lords: detail.lords });
  };
  window.addEventListener(REWARD_CHEST_REQUEST_EVENT, listener);
  return () => window.removeEventListener(REWARD_CHEST_REQUEST_EVENT, listener);
};

let presentations = 0;

/** A staged chest's beats for `request`, each announced as the chest reaches it, under a fresh presentation id. */
export const announcedRewardChestBeats = (request: RewardChestRequest): ChestPresentationBeats => {
  const id = ++presentations;
  const announce = (beat: RewardChestBeat["beat"]) =>
    window.dispatchEvent(new CustomEvent(REWARD_CHEST_BEAT_EVENT, { detail: { id, beat, request } }));
  return { onShown: () => announce("shown"), onOpen: () => announce("opened"), onEnd: () => announce("ended") };
};

export const onRewardChestBeat = (handle: (beat: RewardChestBeat) => void): (() => void) => {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<Partial<RewardChestBeat>>).detail;
    if (typeof detail?.id !== "number" || !detail.beat || !isRequest(detail.request)) return;
    handle({ id: detail.id, beat: detail.beat, request: detail.request });
  };
  window.addEventListener(REWARD_CHEST_BEAT_EVENT, listener);
  return () => window.removeEventListener(REWARD_CHEST_BEAT_EVENT, listener);
};

const isRequest = (value: Partial<RewardChestRequest> | undefined): value is RewardChestRequest =>
  Boolean(value?.prizes && value.rarity && typeof value.lords === "number");
