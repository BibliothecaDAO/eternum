import type { ChestPrize } from "../rewards/chest-reward-reveal";
import type { ChestRarity } from "../rewards/chest-rarity-glow";

/** The HUD asks the world map to stage a reward's chest at the screen's centre: it arrives, opens and goes by itself. */
const REWARD_CHEST_REQUEST_EVENT = "rewardChestRequest";
/** The world map has started that chest: whatever plays beside it starts on the chest's own clock from now. */
const REWARD_CHEST_SHOWN_EVENT = "rewardChestShown";

export interface RewardChestRequest {
  /** What else it gives, shown small under the LORDS: the clear's XP and the troops lost. */
  prizes: readonly ChestPrize[];
  rarity: ChestRarity;
  /** The LORDS the chest pays: the moment's hero, counted up at the centre of the screen. */
  lords: number;
}

export const requestRewardChest = (request: RewardChestRequest): void => {
  window.dispatchEvent(new CustomEvent(REWARD_CHEST_REQUEST_EVENT, { detail: request }));
};

export const onRewardChestRequest = (handle: (request: RewardChestRequest) => void): (() => void) =>
  listen(REWARD_CHEST_REQUEST_EVENT, handle);

export const announceRewardChestShown = (request: RewardChestRequest): void => {
  window.dispatchEvent(new CustomEvent(REWARD_CHEST_SHOWN_EVENT, { detail: request }));
};

export const onRewardChestShown = (handle: (request: RewardChestRequest) => void): (() => void) =>
  listen(REWARD_CHEST_SHOWN_EVENT, handle);

const listen = (name: string, handle: (request: RewardChestRequest) => void): (() => void) => {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<Partial<RewardChestRequest>>).detail;
    if (!detail?.prizes || !detail.rarity || typeof detail.lords !== "number") return;
    handle({ prizes: detail.prizes, rarity: detail.rarity, lords: detail.lords });
  };
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
};
