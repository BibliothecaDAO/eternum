import type { ResourcesIds } from "@bibliothecadao/types";
import { create } from "zustand";

export const REVEAL_GAINS_MS = 2_500;

export const useRevealGains = create<{ gains: ReadonlyMap<ResourcesIds, number>; at: number }>(() => ({
  gains: new Map(),
  at: 0,
}));

export const addRevealGain = (resourceId: ResourcesIds, amount: number, now: number): void =>
  useRevealGains.setState(({ gains, at }) => {
    const standing = now - at < REVEAL_GAINS_MS ? gains : new Map<ResourcesIds, number>();
    return { gains: new Map(standing).set(resourceId, (standing.get(resourceId) ?? 0) + amount), at: now };
  });

export const clearRevealGains = (): void => useRevealGains.setState({ gains: new Map(), at: 0 });
