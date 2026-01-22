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
  const safeArmiesTickDuration = Number.isFinite(armiesTickDuration) && armiesTickDuration > 0 ? armiesTickDuration : 1;
  const timePassedInCurrentTick = currentBlockTimestamp % safeArmiesTickDuration;
  const armiesTickTimeRemaining = safeArmiesTickDuration - timePassedInCurrentTick;

  return {
    currentBlockTimestamp,
    currentDefaultTick,
    currentArmiesTick,
    armiesTickTimeRemaining,
  };
};

export const useBlockTimestampStore = create<BlockTimestampState>((set) => ({
  ...computeTimestampState(),
  tick: () => set(computeTimestampState()),
}));
