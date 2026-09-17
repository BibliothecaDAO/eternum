import { configManager, getBlockTimestamp } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { create } from "zustand";

interface BlockTimestampState {
  currentBlockTimestamp: number;
  currentDefaultTick: number;
  currentArmiesTick: number;
  armiesTickTimeRemaining: number;
  /** Wall-clock milliseconds at the last tick: the one clock every countdown and elapsed-time label reads. */
  nowMs: number;
  tick: () => void;
}

const computeTimestampState = (): Omit<BlockTimestampState, "tick"> => {
  const { currentBlockTimestamp, currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

  const tickConfigArmies = configManager.getTick(TickIds.Armies);
  const armiesTickDuration = Number(tickConfigArmies);
  if (!Number.isFinite(armiesTickDuration) || armiesTickDuration <= 0) throw new Error("Invalid army tick duration");
  const timePassedInCurrentTick = currentBlockTimestamp % armiesTickDuration;
  const armiesTickTimeRemaining = armiesTickDuration - timePassedInCurrentTick;

  return {
    currentBlockTimestamp,
    currentDefaultTick,
    currentArmiesTick,
    armiesTickTimeRemaining,
    nowMs: Date.now(),
  };
};

export const useBlockTimestampStore = create<BlockTimestampState>((set) => ({
  // Imports precede the game snapshot. Read configuration only when a game consumer requests a tick.
  get currentBlockTimestamp() {
    return getBlockTimestamp().currentBlockTimestamp;
  },
  get currentDefaultTick() {
    return computeTimestampState().currentDefaultTick;
  },
  get currentArmiesTick() {
    return computeTimestampState().currentArmiesTick;
  },
  get armiesTickTimeRemaining() {
    return computeTimestampState().armiesTickTimeRemaining;
  },
  nowMs: Date.now(),
  tick: () => set(computeTimestampState()),
}));
