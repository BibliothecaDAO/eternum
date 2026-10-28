import type { ChestPrize } from "../rewards/chest-reward-reveal";
import type { ChestRarity } from "../rewards/chest-rarity-glow";

/** The HUD asks the world map to stage a reward's chest at the screen's centre: it arrives, opens and goes by itself. */
const REWARD_CHEST_REQUEST_EVENT = "rewardChestRequest";

interface RewardChestRequest {
  prizes: readonly ChestPrize[];
  rarity: ChestRarity;
}

export const requestRewardChest = (request: RewardChestRequest): void => {
  window.dispatchEvent(new CustomEvent(REWARD_CHEST_REQUEST_EVENT, { detail: request }));
};

export const onRewardChestRequest = (handle: (request: RewardChestRequest) => void): (() => void) => {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<Partial<RewardChestRequest>>).detail;
    if (!detail?.prizes || !detail.rarity) return;
    handle({ prizes: detail.prizes, rarity: detail.rarity });
  };
  window.addEventListener(REWARD_CHEST_REQUEST_EVENT, listener);
  return () => window.removeEventListener(REWARD_CHEST_REQUEST_EVENT, listener);
};
