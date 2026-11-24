import { useSyncExternalStore } from "react";

let highestPercent = 0;
const listeners = new Set<() => void>();

const clampPercent = (percent: number): number => Math.max(0, Math.min(100, Math.round(percent)));

const notify = () => {
  for (const listener of listeners) listener();
};

export const advanceLoadingProgress = (percent: number): number => {
  const next = clampPercent(percent);
  if (next > highestPercent) {
    highestPercent = next;
    notify();
  }
  return highestPercent;
};

export const resetLoadingProgress = () => {
  if (highestPercent === 0) return;
  highestPercent = 0;
  notify();
};

const getLoadingProgress = (): number => highestPercent;

const subscribeLoadingProgress = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useMonotonicLoadingProgress = (percent?: number): number => {
  const current = useSyncExternalStore(subscribeLoadingProgress, getLoadingProgress, getLoadingProgress);
  return percent === undefined ? current : Math.max(current, clampPercent(percent));
};
