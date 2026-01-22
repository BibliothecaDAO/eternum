import { configManager } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { create } from "zustand";

interface BlockTimestampState {
  currentDefaultTick: number;
  tick: () => void;
}

const computeDefaultTick = (): number => {
  const timestamp = Math.floor(Date.now() / 1000);
  const tickConfigDefault = configManager.getTick(TickIds.Default);
  return Math.floor(timestamp / Number(tickConfigDefault));
};

export const useBlockTimestampStore = create<BlockTimestampState>((set) => ({
  currentDefaultTick: computeDefaultTick(),
  tick: () => set({ currentDefaultTick: computeDefaultTick() }),
}));

if (typeof window !== "undefined") {
  const tickIntervalKey = "__eternumMobileBlockTimestampTickInterval";
  const target = window as typeof window & {
    [k: string]: unknown;
  };

  if (!target[tickIntervalKey]) {
    target[tickIntervalKey] = window.setInterval(() => {
      useBlockTimestampStore.getState().tick();
    }, 10_000);
  }
}
