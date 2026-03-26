import { configManager, getBlockTimestamp } from "@bibliothecadao/eternum";
import { TickIds } from "@bibliothecadao/types";
import { create } from "zustand";
import { useChainTimeStore } from "./use-chain-time-store";

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

const syncBlockTimestampState = () => {
  useBlockTimestampStore.setState((state) => ({
    ...state,
    ...computeTimestampState(),
  }));
};

const BLOCK_TIMESTAMP_CHAIN_SYNC_KEY = "__eternumBlockTimestampChainSync";

type BlockTimestampSyncTarget = typeof globalThis & {
  [BLOCK_TIMESTAMP_CHAIN_SYNC_KEY]?: (() => void) | true;
};

const ensureBlockTimestampChainSync = () => {
  const target = globalThis as BlockTimestampSyncTarget;

  if (target[BLOCK_TIMESTAMP_CHAIN_SYNC_KEY]) {
    return;
  }

  target[BLOCK_TIMESTAMP_CHAIN_SYNC_KEY] = useChainTimeStore.subscribe((state, previousState) => {
    if (state.nowMs === previousState.nowMs) {
      return;
    }

    syncBlockTimestampState();
  });

  syncBlockTimestampState();
};

ensureBlockTimestampChainSync();
