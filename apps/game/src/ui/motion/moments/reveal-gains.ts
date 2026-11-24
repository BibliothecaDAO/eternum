import type { ResourcesIds } from "@bibliothecadao/types";
import { create } from "zustand";

/** How long a reveal's gains stand under the bar; another reveal within it adds to them and holds them again. */
export const REVEAL_GAINS_MS = 2_500;

/** What the player's own reveals just paid, by resource, while their pill stands: a flourish, never a game fact. */
export const useRevealGains = create<{ gains: Partial<Record<ResourcesIds, number>>; at: number }>(() => ({
  gains: {},
  at: 0,
}));

export const addRevealGain = (resourceId: ResourcesIds, amount: number, now: number): void =>
  useRevealGains.setState(({ gains, at }) => ({
    gains: { ...(now - at < REVEAL_GAINS_MS ? gains : {}), [resourceId]: (now - at < REVEAL_GAINS_MS ? (gains[resourceId] ?? 0) : 0) + amount },
    at: now,
  }));

export const clearRevealGains = (): void => useRevealGains.setState({ gains: {}, at: 0 });
