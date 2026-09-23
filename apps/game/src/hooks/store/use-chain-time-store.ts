import { create } from "zustand";

import { logChainTimeDebug } from "@/utils/chain-time-debug";

type ProviderHeartbeat = {
  timestamp: number;
  blockNumber?: number;
  source?: string;
};

interface ChainTimeState {
  lastHeartbeat: ProviderHeartbeat | null;
  anchorTimestampMs: number | null;
  anchorPerfMs: number | null;
  /** Chain time, ticking between heads; null until a confirmed head anchors it. */
  nowMs: number | null;
  setHeartbeat: (heartbeat: ProviderHeartbeat) => void;
  /** Anchors a new game's chain time at its first confirmed head, replacing the previous game's without ratcheting. */
  anchor: (heartbeat: ProviderHeartbeat) => void;
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

/** Chain time between heads, or null before any head: it is never guessed from the local clock. */
const computeNowMs = (anchorTimestampMs: number | null, anchorPerfMs: number | null): number | null => {
  if (anchorTimestampMs === null || anchorPerfMs === null) return null;

  const deltaMs = getPerfNowMs() - anchorPerfMs;
  return anchorTimestampMs + Math.max(0, deltaMs);
};

export const useChainTimeStore = create<ChainTimeState>((set, get) => ({
  lastHeartbeat: null,
  anchorTimestampMs: null,
  anchorPerfMs: null,
  nowMs: null,
  setHeartbeat: (heartbeat: ProviderHeartbeat) =>
    set((state) => {
      if (state.lastHeartbeat && state.lastHeartbeat.timestamp > heartbeat.timestamp) {
        logChainTimeDebug("heartbeat_discarded_stale", {
          heartbeatTimestampMs: heartbeat.timestamp,
          lastHeartbeatTimestampMs: state.lastHeartbeat.timestamp,
          heartbeatBlockNumber: heartbeat.blockNumber ?? null,
          heartbeatSource: heartbeat.source ?? "unknown",
        });
        return state;
      }

      const currentNowMs = computeNowMs(state.anchorTimestampMs, state.anchorPerfMs) ?? heartbeat.timestamp;
      const anchorPerfMs = getPerfNowMs();

      // Cap how far the client clock can lead the chain.
      // Without a cap, Math.max creates a one-way ratchet where drift
      // accumulates indefinitely (the client can never sync back down).
      // 5 seconds covers normal block-to-block jitter and RPC latency
      // while preventing the unbounded inflation that causes tx failures.
      const MAX_LEAD_MS = 5_000;
      const leadMs = currentNowMs - heartbeat.timestamp;
      const anchorTimestampMs =
        leadMs > MAX_LEAD_MS ? heartbeat.timestamp + MAX_LEAD_MS : Math.max(heartbeat.timestamp, currentNowMs);
      const rewindPreventedMs = Math.max(0, currentNowMs - heartbeat.timestamp);

      logChainTimeDebug("heartbeat_applied", {
        heartbeatTimestampMs: heartbeat.timestamp,
        heartbeatBlockNumber: heartbeat.blockNumber ?? null,
        heartbeatSource: heartbeat.source ?? "unknown",
        previousAnchorTimestampMs: state.anchorTimestampMs,
        previousNowMs: currentNowMs,
        nextAnchorTimestampMs: anchorTimestampMs,
        rewindPreventedMs,
        driftCappedMs: leadMs > MAX_LEAD_MS ? leadMs - MAX_LEAD_MS : 0,
      });

      return {
        lastHeartbeat: heartbeat,
        anchorTimestampMs,
        anchorPerfMs,
        nowMs: anchorTimestampMs,
      };
    }),
  anchor: (heartbeat: ProviderHeartbeat) => {
    logChainTimeDebug("heartbeat_anchored", {
      heartbeatTimestampMs: heartbeat.timestamp,
      heartbeatBlockNumber: heartbeat.blockNumber ?? null,
      heartbeatSource: heartbeat.source ?? "unknown",
    });
    set({
      lastHeartbeat: heartbeat,
      anchorTimestampMs: heartbeat.timestamp,
      anchorPerfMs: getPerfNowMs(),
      nowMs: heartbeat.timestamp,
    });
  },
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
  getNowMs: () => {
    const nowMs = computeNowMs(get().anchorTimestampMs, get().anchorPerfMs);
    if (nowMs === null) throw new Error("Chain time is not known yet: no confirmed head has anchored it");
    return nowMs;
  },
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
