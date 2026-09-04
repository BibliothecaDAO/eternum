import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
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

/** Wall-clock milliseconds, once per second; a disabled subscriber reads a constant and never re-renders for the clock. */
export const useNowMs = (enabled: boolean = true) => useBlockTimestampStore((state) => (enabled ? state.nowMs : 0));

/** Wall-clock seconds, once per second; a disabled subscriber reads a constant and never re-renders for the clock. */
export const useNowSeconds = (enabled: boolean = true) =>
  useBlockTimestampStore((state) => (enabled ? Math.floor(state.nowMs / 1000) : 0));

/** Wall-clock seconds floored to a window, for consumers that only need to wake every so often. */
export const useCoarseNowSeconds = (windowSeconds: number) =>
  useBlockTimestampStore((state) => {
    const window = normalizeCoarseTickWindow(windowSeconds);
    return Math.floor(state.nowMs / 1000 / window) * window;
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
