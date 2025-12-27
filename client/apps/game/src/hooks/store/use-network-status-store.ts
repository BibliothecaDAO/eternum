import type { ProviderHeartbeat } from "@bibliothecadao/provider";
import { create } from "zustand";

// Warning levels for progressive escalation
export type WarningLevel = "normal" | "waiting" | "delayed" | "desync";

// Network-specific threshold configurations (in milliseconds)
export type NetworkType = "mainnet" | "sepolia" | "slot" | "slottest" | "local";

interface NetworkThresholds {
  waiting: number; // Show subtle indicator
  delayed: number; // Show warning modal
  desync: number; // Show urgent modal with resync
}

const NETWORK_THRESHOLDS: Record<NetworkType, NetworkThresholds> = {
  mainnet: { waiting: 15_000, delayed: 30_000, desync: 45_000 },
  sepolia: { waiting: 30_000, delayed: 60_000, desync: 120_000 },
  slot: { waiting: 15_000, delayed: 30_000, desync: 45_000 },
  slottest: { waiting: 20_000, delayed: 45_000, desync: 90_000 },
  local: { waiting: 15_000, delayed: 30_000, desync: 60_000 },
};

const DEFAULT_NETWORK: NetworkType = "local";

type NetworkStatusInputs = {
  lastHeartbeat: ProviderHeartbeat | null;
  thresholds: NetworkThresholds;
  forcedDesyncUntil: number | null;
  now: number;
  lastTransactionSubmittedAt: number | null;
  lastTransactionConfirmedAt: number | null;
};

const computeWarningLevel = (elapsedMs: number | null, thresholds: NetworkThresholds): WarningLevel => {
  if (elapsedMs === null) return "normal";
  if (elapsedMs >= thresholds.desync) return "desync";
  if (elapsedMs >= thresholds.delayed) return "delayed";
  if (elapsedMs >= thresholds.waiting) return "waiting";
  return "normal";
};

const computeNetworkStatus = ({
  lastHeartbeat,
  thresholds,
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

  // Forced desync for testing
  if (forcedDesyncUntil !== null && now < forcedDesyncUntil) {
    return {
      isDesynced: true,
      warningLevel: "desync",
      elapsedMs: pendingElapsed ?? baselineElapsed,
      heartbeat: lastHeartbeat,
      reason: "forced",
    };
  }

  // Pending transaction - use progressive warnings
  if (hasPendingTx && pendingElapsed !== null) {
    const warningLevel = computeWarningLevel(pendingElapsed, thresholds);
    return {
      isDesynced: warningLevel === "desync",
      warningLevel,
      elapsedMs: pendingElapsed,
      heartbeat: lastHeartbeat,
      reason: warningLevel !== "normal" ? "pending-tx" : null,
    };
  }

  // No pending transaction - normal state
  return {
    isDesynced: false,
    warningLevel: "normal",
    elapsedMs: baselineElapsed,
    heartbeat: lastHeartbeat,
    reason: null,
  };
};

type DesyncReason = "forced" | "pending-tx" | null;

export interface NetworkStatus {
  isDesynced: boolean;
  warningLevel: WarningLevel;
  elapsedMs: number | null;
  heartbeat: ProviderHeartbeat | null;
  reason: DesyncReason;
}

interface NetworkStatusState {
  lastHeartbeat: ProviderHeartbeat | null;
  networkType: NetworkType;
  thresholds: NetworkThresholds;
  forcedDesyncUntil: number | null;
  now: number;
  lastTransactionSubmittedAt: number | null;
  lastTransactionConfirmedAt: number | null;
  status: NetworkStatus;
  setHeartbeat: (heartbeat: ProviderHeartbeat) => void;
  setNetworkType: (networkType: NetworkType) => void;
  forceDesync: (durationMs?: number) => void;
  clearForcedDesync: () => void;
  tick: () => void;
  getStatus: () => NetworkStatus;
}

const initialNow = Date.now();
const initialThresholds = NETWORK_THRESHOLDS[DEFAULT_NETWORK];

export const useNetworkStatusStore = create<NetworkStatusState>((set, get) => ({
  lastHeartbeat: null,
  networkType: DEFAULT_NETWORK,
  thresholds: initialThresholds,
  forcedDesyncUntil: null,
  now: initialNow,
  lastTransactionSubmittedAt: null,
  lastTransactionConfirmedAt: null,
  status: computeNetworkStatus({
    lastHeartbeat: null,
    thresholds: initialThresholds,
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
          thresholds: state.thresholds,
          forcedDesyncUntil: state.forcedDesyncUntil,
          now: state.now,
          lastTransactionSubmittedAt: updates.lastTransactionSubmittedAt ?? state.lastTransactionSubmittedAt,
          lastTransactionConfirmedAt: updates.lastTransactionConfirmedAt ?? state.lastTransactionConfirmedAt,
        }),
      };
    });
  },
  setNetworkType: (networkType) =>
    set((state) => {
      if (state.networkType === networkType) {
        return state;
      }
      const thresholds = NETWORK_THRESHOLDS[networkType];
      return {
        networkType,
        thresholds,
        status: computeNetworkStatus({
          lastHeartbeat: state.lastHeartbeat,
          thresholds,
          forcedDesyncUntil: state.forcedDesyncUntil,
          now: state.now,
          lastTransactionSubmittedAt: state.lastTransactionSubmittedAt,
          lastTransactionConfirmedAt: state.lastTransactionConfirmedAt,
        }),
      };
    }),
  forceDesync: (durationMs) => {
    const ttl = durationMs ?? get().thresholds.desync;
    const now = Date.now();
    const forcedDesyncUntil = now + ttl;
    set((state) => ({
      forcedDesyncUntil,
      now,
      status: computeNetworkStatus({
        lastHeartbeat: state.lastHeartbeat,
        thresholds: state.thresholds,
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
          thresholds: state.thresholds,
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
          thresholds: state.thresholds,
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
      setNetwork: (networkType: NetworkType) => useNetworkStatusStore.getState().setNetworkType(networkType),
      thresholds: () => useNetworkStatusStore.getState().thresholds,
    };
  }
}
