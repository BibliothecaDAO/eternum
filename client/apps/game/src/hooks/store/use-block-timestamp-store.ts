import { configManager, getBlockTimestamp } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { create } from "zustand";

interface BlockTimestampState {
  currentBlockTimestamp: number;
  currentDefaultTick: number;
  currentArmiesTick: number;
  armiesTickTimeRemaining: number;
  tick: () => void;
}

const computeTimestampState = (): Omit<BlockTimestampState, "tick"> => {
  const { currentBlockTimestamp, currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

  const tickConfigArmies = configManager.getTick(TickIds.Armies);
  const armiesTickDuration = Number(tickConfigArmies);
  const timePassedInCurrentTick = currentBlockTimestamp % armiesTickDuration;
  const armiesTickTimeRemaining = armiesTickDuration - timePassedInCurrentTick;

  return {
    currentBlockTimestamp,
    currentDefaultTick,
    currentArmiesTick,
    armiesTickTimeRemaining,
  };
};

export const useBlockTimestampStore = create<BlockTimestampState>((set) => ({
  currentBlockTimestamp: Math.floor(Date.now() / 1000),
  currentDefaultTick: 0,
  currentArmiesTick: 0,
  armiesTickTimeRemaining: 0,
  tick: () => set(computeTimestampState()),
}));

if (typeof window !== "undefined") {
  const tickIntervalKey = "__eternumBlockTimestampTickInterval";
  const target = window as typeof window & {
    [k: string]: unknown;
  };

  if (!target[tickIntervalKey]) {
    const runTick = () => {
      useBlockTimestampStore.getState().tick();
    };
    runTick();
    target[tickIntervalKey] = window.setInterval(runTick, 10_000);
  }
}
