import type { ProviderHeartbeat } from "@bibliothecadao/provider";
import { create } from "zustand";

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
  setHeartbeat: (heartbeat) =>
    set((state) => {
      // Reject heartbeat if it's older than the last received heartbeat
      if (state.lastHeartbeat && state.lastHeartbeat.timestamp > heartbeat.timestamp) {
        return state;
      }

      // Check if new heartbeat would cause time to jump backwards from our current interpolated time
      const currentInterpolatedMs = computeNowMs(state.anchorTimestampMs, state.anchorPerfMs);
      const timeDeltaMs = heartbeat.timestamp - currentInterpolatedMs;

      // Only accept heartbeats that move time forward (or are very close to current time)
      // This prevents time from jumping backwards, which causes UI issues like timers resetting
      const TOLERANCE_MS = 1000; // Allow small backwards adjustments within 1 second
      if (timeDeltaMs < -TOLERANCE_MS) {
        console.warn(
          `[chain-time] Rejecting heartbeat: would move time backwards by ${Math.abs(timeDeltaMs)}ms. ` +
            `Current: ${currentInterpolatedMs}, Chain: ${heartbeat.timestamp}`
        );
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
