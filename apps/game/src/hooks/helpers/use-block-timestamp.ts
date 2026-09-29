import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useShallow } from "zustand/react/shallow";

const normalizeCoarseTickWindow = (windowSeconds: number) => {
  if (!Number.isFinite(windowSeconds) || windowSeconds <= 1) {
    return 1;
  }

  return Math.floor(windowSeconds);
};

export const selectCurrentDefaultTick = (state: { currentDefaultTick: number }) => state.currentDefaultTick;

export const selectCoarseCurrentDefaultTick = (state: { currentDefaultTick: number }, windowSeconds: number = 10) => {
  const normalizedWindow = normalizeCoarseTickWindow(windowSeconds);
  if (normalizedWindow === 1) {
    return state.currentDefaultTick;
  }

  return Math.floor(state.currentDefaultTick / normalizedWindow) * normalizedWindow;
};

export const useCurrentBlockTimestamp = () => useBlockTimestampStore((state) => state.currentBlockTimestamp);

export const useCurrentDefaultTick = () => useBlockTimestampStore(selectCurrentDefaultTick);

export const useCoarseCurrentDefaultTick = (windowSeconds: number = 10) =>
  useBlockTimestampStore((state) => selectCoarseCurrentDefaultTick(state, windowSeconds));

/**
 * Chain time for a rendered component. The game renders only once its client has a confirmed head, so a component
 * that reads the clock earlier is a bug, and it fails by name instead of reading a guessed wall clock.
 */
const requireChainNowMs = (nowMs: number | null): number => {
  if (nowMs === null) throw new Error("Chain time is not known yet: a component read the clock before the first head");
  return nowMs;
};

/** Chain-time milliseconds, once per second; a disabled subscriber reads a constant and never re-renders for it. */
export const useNowMs = (enabled: boolean = true) =>
  useChainTimeStore((state) => (enabled ? requireChainNowMs(state.nowMs) : 0));

/** Chain-time seconds, once per second; a disabled subscriber reads a constant and never re-renders for it. */
export const useNowSeconds = (enabled: boolean = true) =>
  useChainTimeStore((state) => (enabled ? Math.floor(requireChainNowMs(state.nowMs) / 1000) : 0));

/** Chain-time seconds floored to a window, for consumers that only need to wake every so often. */
export const useCoarseNowSeconds = (windowSeconds: number) =>
  useChainTimeStore((state) => {
    const window = normalizeCoarseTickWindow(windowSeconds);
    return Math.floor(requireChainNowMs(state.nowMs) / 1000 / window) * window;
  });

export const useCurrentArmiesTick = () => useBlockTimestampStore((state) => state.currentArmiesTick);

export const useBlockTimestamp = () =>
  useBlockTimestampStore(
    useShallow((state) => ({
      currentBlockTimestamp: state.currentBlockTimestamp,
      currentDefaultTick: state.currentDefaultTick,
      currentArmiesTick: state.currentArmiesTick,
      armiesTickTimeRemaining: state.armiesTickTimeRemaining,
    })),
  );
