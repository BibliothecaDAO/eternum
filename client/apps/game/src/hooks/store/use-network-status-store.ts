import type { ProviderHeartbeat } from "@bibliothecadao/provider";
import { create } from "zustand";

type NetworkStatusInputs = {
  lastHeartbeat: ProviderHeartbeat | null;
  thresholdMs: number;
  forcedDesyncUntil: number | null;
  now: number;
  lastTransactionSubmittedAt: number | null;
  lastTransactionConfirmedAt: number | null;
};

const computeNetworkStatus = ({
  lastHeartbeat,
  thresholdMs,
  forcedDesyncUntil,
  now,
  lastTransactionSubmittedAt,
  lastTransactionConfirmedAt,
}: NetworkStatusInputs): NetworkStatus => {
  const baselineElapsed = lastHeartbeat ? now - lastHeartbeat.timestamp : null;
  const hasPendingTx =
    lastTransactionSubmittedAt !== null &&
    (lastTransactionConfirmedAt === null || lastTransactionConfirmedAt < lastTransactionSubmittedAt);
  const pendingElapsed = hasPendingTx && lastTransactionSubmittedAt !== null ? now - lastTransactionSubmittedAt : null;

  if (forcedDesyncUntil !== null && now < forcedDesyncUntil) {
    return {
      isDesynced: true,
      elapsedMs: pendingElapsed ?? baselineElapsed,
      heartbeat: lastHeartbeat,
      reason: "forced",
    };
  }

  if (hasPendingTx && pendingElapsed !== null && pendingElapsed > thresholdMs) {
    return {
      isDesynced: true,
      elapsedMs: pendingElapsed,
      heartbeat: lastHeartbeat,
      reason: "pending-tx",
    };
  }

  if (!lastHeartbeat) {
    return {
      isDesynced: false,
      elapsedMs: null,
      heartbeat: null,
      reason: "no-heartbeat",
    };
  }

  return {
    isDesynced: false,
    elapsedMs: pendingElapsed ?? baselineElapsed,
    heartbeat: lastHeartbeat,
    reason: null,
  };
};

const DEFAULT_THRESHOLD_MS = 10_000;

type DesyncReason = "forced" | "pending-tx" | "no-heartbeat" | null;

export interface NetworkStatus {
  isDesynced: boolean;
  elapsedMs: number | null;
  heartbeat: ProviderHeartbeat | null;
  reason: DesyncReason;
}

interface NetworkStatusState {
  lastHeartbeat: ProviderHeartbeat | null;
  thresholdMs: number;
  forcedDesyncUntil: number | null;
  now: number;
  lastTransactionSubmittedAt: number | null;
  lastTransactionConfirmedAt: number | null;
  status: NetworkStatus;
  setHeartbeat: (heartbeat: ProviderHeartbeat) => void;
  setThreshold: (thresholdMs: number) => void;
  forceDesync: (durationMs?: number) => void;
  clearForcedDesync: () => void;
  tick: () => void;
  getStatus: () => NetworkStatus;
}

const initialNow = Date.now();

export const useNetworkStatusStore = create<NetworkStatusState>((set, get) => ({
  lastHeartbeat: null,
  thresholdMs: DEFAULT_THRESHOLD_MS,
  forcedDesyncUntil: null,
  now: initialNow,
  lastTransactionSubmittedAt: null,
  lastTransactionConfirmedAt: null,
  status: computeNetworkStatus({
    lastHeartbeat: null,
    thresholdMs: DEFAULT_THRESHOLD_MS,
    forcedDesyncUntil: null,
    now: initialNow,
    lastTransactionSubmittedAt: null,
    lastTransactionConfirmedAt: null,
  }),
  setHeartbeat: (heartbeat) => {
    set((state) => {
      if (state.lastHeartbeat && state.lastHeartbeat.timestamp > heartbeat.timestamp) {
        return state;
      }

      const updates: Partial<NetworkStatusState> = { lastHeartbeat: heartbeat };

      if (heartbeat.source === "transaction-submitted") {
        updates.lastTransactionSubmittedAt = heartbeat.timestamp;
      }

      if (heartbeat.source === "transaction-confirmed") {
        updates.lastTransactionConfirmedAt = heartbeat.timestamp;
      }

      return {
        ...updates,
        status: computeNetworkStatus({
          lastHeartbeat: updates.lastHeartbeat ?? state.lastHeartbeat,
          thresholdMs: state.thresholdMs,
          forcedDesyncUntil: state.forcedDesyncUntil,
          now: state.now,
          lastTransactionSubmittedAt: updates.lastTransactionSubmittedAt ?? state.lastTransactionSubmittedAt,
          lastTransactionConfirmedAt: updates.lastTransactionConfirmedAt ?? state.lastTransactionConfirmedAt,
        }),
      };
    });
  },
  setThreshold: (thresholdMs) =>
    set((state) => {
      if (state.thresholdMs === thresholdMs) {
        return state;
      }
      return {
        thresholdMs,
        status: computeNetworkStatus({
          lastHeartbeat: state.lastHeartbeat,
          thresholdMs,
          forcedDesyncUntil: state.forcedDesyncUntil,
          now: state.now,
          lastTransactionSubmittedAt: state.lastTransactionSubmittedAt,
          lastTransactionConfirmedAt: state.lastTransactionConfirmedAt,
        }),
      };
    }),
  forceDesync: (durationMs) => {
    const ttl = durationMs ?? get().thresholdMs * 2;
    const now = Date.now();
    const forcedDesyncUntil = now + ttl;
    set((state) => ({
      forcedDesyncUntil,
      now,
      status: computeNetworkStatus({
        lastHeartbeat: state.lastHeartbeat,
        thresholdMs: state.thresholdMs,
        forcedDesyncUntil,
        now,
        lastTransactionSubmittedAt: state.lastTransactionSubmittedAt,
        lastTransactionConfirmedAt: state.lastTransactionConfirmedAt,
      }),
    }));
  },
  clearForcedDesync: () =>
    set((state) => {
      if (state.forcedDesyncUntil === null) {
        return state;
      }

      return {
        forcedDesyncUntil: null,
        status: computeNetworkStatus({
          lastHeartbeat: state.lastHeartbeat,
          thresholdMs: state.thresholdMs,
          forcedDesyncUntil: null,
          now: state.now,
          lastTransactionSubmittedAt: state.lastTransactionSubmittedAt,
          lastTransactionConfirmedAt: state.lastTransactionConfirmedAt,
        }),
      };
    }),
  tick: () =>
    set((state) => {
      const now = Date.now();
      if (now === state.now) {
        return state;
      }

      return {
        now,
        status: computeNetworkStatus({
          lastHeartbeat: state.lastHeartbeat,
          thresholdMs: state.thresholdMs,
          forcedDesyncUntil: state.forcedDesyncUntil,
          now,
          lastTransactionSubmittedAt: state.lastTransactionSubmittedAt,
          lastTransactionConfirmedAt: state.lastTransactionConfirmedAt,
        }),
      };
    }),
  getStatus: () => get().status,
}));

if (typeof window !== "undefined") {
  const debugKey = "__eternumNetworkDebug";
  const target = window as typeof window & {
    [k: string]: unknown;
  };

  const tickIntervalKey = "__eternumNetworkTickInterval";
  if (!target[tickIntervalKey]) {
    const runTick = () => {
      useNetworkStatusStore.getState().tick();
    };
    runTick();
    target[tickIntervalKey] = window.setInterval(runTick, 1_000);
  }

  if (!target[debugKey]) {
    target[debugKey] = {
      forceDesync: (durationMs?: number) => useNetworkStatusStore.getState().forceDesync(durationMs),
      clear: () => useNetworkStatusStore.getState().clearForcedDesync(),
      status: () => useNetworkStatusStore.getState().getStatus(),
    };
  }
}
