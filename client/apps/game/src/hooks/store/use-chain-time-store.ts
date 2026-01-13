import { create } from "zustand";

export type ProviderHeartbeat = {
  timestamp: number;
  // Add more fields if the real ProviderHeartbeat has them
};

interface ChainTimeState {
  lastHeartbeat: ProviderHeartbeat | null;
  anchorTimestampMs: number | null;
  anchorPerfMs: number | null;
  nowMs: number;
  setHeartbeat: (heartbeat: ProviderHeartbeat) => void;
  tick: () => void;
  getNowMs: () => number;
  getNowSeconds: () => number;
}

const getPerfNowMs = (): number => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
};

const computeNowMs = (anchorTimestampMs: number | null, anchorPerfMs: number | null): number => {
  if (anchorTimestampMs === null || anchorPerfMs === null) {
    return Date.now();
  }

  const deltaMs = getPerfNowMs() - anchorPerfMs;
  return anchorTimestampMs + Math.max(0, deltaMs);
};

export const useChainTimeStore = create<ChainTimeState>((set, get) => ({
  lastHeartbeat: null,
  anchorTimestampMs: null,
  anchorPerfMs: null,
  nowMs: Date.now(),
  setHeartbeat: (heartbeat: ProviderHeartbeat) =>
    set((state) => {
      if (state.lastHeartbeat && state.lastHeartbeat.timestamp > heartbeat.timestamp) {
        return state;
      }

      const anchorTimestampMs = heartbeat.timestamp;
      const anchorPerfMs = getPerfNowMs();

      return {
        lastHeartbeat: heartbeat,
        anchorTimestampMs,
        anchorPerfMs,
        nowMs: anchorTimestampMs,
      };
    }),
  tick: () =>
    set((state) => {
      const nowMs = computeNowMs(state.anchorTimestampMs, state.anchorPerfMs);
      if (nowMs === state.nowMs) {
        return state;
      }
      return {
        nowMs,
      };
    }),
  getNowMs: () => computeNowMs(get().anchorTimestampMs, get().anchorPerfMs),
  getNowSeconds: () => Math.floor(get().getNowMs() / 1000),
}));

if (typeof window !== "undefined") {
  const tickIntervalKey = "__eternumChainTimeTickInterval";
  const target = window as typeof window & {
    [k: string]: unknown;
  };

  if (!target[tickIntervalKey]) {
    const runTick = () => {
      useChainTimeStore.getState().tick();
    };
    runTick();
    target[tickIntervalKey] = window.setInterval(runTick, 1_000);
  }
}
