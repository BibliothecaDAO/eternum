import { create } from "zustand";

export type ConnectionStatus = "connected" | "degraded" | "disconnected";
export type StreamStatus = "connected" | "stale" | "reconnecting" | "failed";

interface ConnectionState {
  status: ConnectionStatus;
  spatialStatus: StreamStatus;
  globalStatus: StreamStatus;
  lastSpatialUpdate: number;
  lastGlobalUpdate: number;
  lastSpatialDataUpdate: number;
  lastGlobalDataUpdate: number;
  lastSpatialHandshake: number;
  lastGlobalHandshake: number;
  lastToriiHeartbeat: number;
  toriiHeartbeatAvailable: boolean;
  /** Interval (ms) between the two most recent heartbeats; null until the second tick. */
  lastHeartbeatIntervalMs: number | null;
  lastHealthCheck: number;
  lastConnectedAt: number;
  lastDisconnectedAt: number | null;
  reconnectAttempts: number;
  streamReconnectVersion: number;
  // --- Disconnect-source signals (used by classifyDisconnect) ---
  /** Snapshot of navigator.onLine, kept fresh via the browser online/offline events. */
  isOnline: boolean;
  /** Timestamp of the last browser `offline` event, or null if none observed. */
  lastOfflineAt: number | null;
  /** Timestamp of the last observed real stream close/error (best-effort; usually null). */
  lastStreamCloseAt: number | null;
  setStatus: (status: ConnectionStatus) => void;
  setSpatialStatus: (status: StreamStatus) => void;
  setGlobalStatus: (status: StreamStatus) => void;
  recordSpatialUpdate: () => void;
  recordGlobalUpdate: () => void;
  recordSpatialHandshake: () => void;
  recordGlobalHandshake: () => void;
  recordToriiHeartbeat: () => void;
  recordHealthCheck: () => void;
  recordStreamReconnect: () => void;
  recordOnline: () => void;
  recordOffline: () => void;
  recordStreamClose: () => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
}

const readInitialOnline = (): boolean => (typeof navigator !== "undefined" ? navigator.onLine : true);

const deriveOverallStatus = (spatial: StreamStatus, global: StreamStatus): ConnectionStatus => {
  if (spatial === "failed" || global === "failed") return "disconnected";
  if (spatial === "connected" && global === "connected") return "connected";
  return "degraded";
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "connected",
  spatialStatus: "connected",
  globalStatus: "connected",
  lastSpatialUpdate: Date.now(),
  lastGlobalUpdate: Date.now(),
  lastSpatialDataUpdate: Date.now(),
  lastGlobalDataUpdate: Date.now(),
  lastSpatialHandshake: 0,
  lastGlobalHandshake: 0,
  lastToriiHeartbeat: Date.now(),
  toriiHeartbeatAvailable: false,
  lastHeartbeatIntervalMs: null,
  lastHealthCheck: Date.now(),
  lastConnectedAt: Date.now(),
  lastDisconnectedAt: null,
  reconnectAttempts: 0,
  streamReconnectVersion: 0,
  isOnline: readInitialOnline(),
  lastOfflineAt: null,
  lastStreamCloseAt: null,
  setStatus: (status: ConnectionStatus) =>
    set((state) => {
      const now = Date.now();
      return {
        status,
        lastConnectedAt: status === "connected" ? now : state.lastConnectedAt,
        lastDisconnectedAt:
          status !== "connected" && state.status === "connected"
            ? now
            : status === "connected"
              ? null
              : state.lastDisconnectedAt,
      };
    }),
  setSpatialStatus: (spatialStatus: StreamStatus) =>
    set((state) => {
      const nextStatus = deriveOverallStatus(spatialStatus, state.globalStatus);
      const now = Date.now();
      return {
        spatialStatus,
        status: nextStatus,
        lastConnectedAt: nextStatus === "connected" ? now : state.lastConnectedAt,
        lastDisconnectedAt:
          nextStatus !== "connected" && state.status === "connected"
            ? now
            : nextStatus === "connected"
              ? null
              : state.lastDisconnectedAt,
      };
    }),
  setGlobalStatus: (globalStatus: StreamStatus) =>
    set((state) => {
      const nextStatus = deriveOverallStatus(state.spatialStatus, globalStatus);
      const now = Date.now();
      return {
        globalStatus,
        status: nextStatus,
        lastConnectedAt: nextStatus === "connected" ? now : state.lastConnectedAt,
        lastDisconnectedAt:
          nextStatus !== "connected" && state.status === "connected"
            ? now
            : nextStatus === "connected"
              ? null
              : state.lastDisconnectedAt,
      };
    }),
  recordSpatialUpdate: () => {
    const now = Date.now();
    set({ lastSpatialUpdate: now, lastSpatialDataUpdate: now });
  },
  recordGlobalUpdate: () => {
    const now = Date.now();
    set({ lastGlobalUpdate: now, lastGlobalDataUpdate: now });
  },
  recordSpatialHandshake: () => {
    const now = Date.now();
    set({ lastSpatialUpdate: now, lastSpatialHandshake: now });
  },
  recordGlobalHandshake: () => {
    const now = Date.now();
    set({ lastGlobalUpdate: now, lastGlobalHandshake: now });
  },
  recordToriiHeartbeat: () =>
    set((state) => {
      const now = Date.now();
      // Only treat the gap as a real heartbeat interval once a heartbeat has
      // actually been received before (avoids reporting the time since store init).
      const intervalMs = state.toriiHeartbeatAvailable ? now - state.lastToriiHeartbeat : null;
      return { lastToriiHeartbeat: now, toriiHeartbeatAvailable: true, lastHeartbeatIntervalMs: intervalMs };
    }),
  recordHealthCheck: () => set({ lastHealthCheck: Date.now() }),
  recordStreamReconnect: () => set((state) => ({ streamReconnectVersion: state.streamReconnectVersion + 1 })),
  recordOnline: () => set({ isOnline: true }),
  recordOffline: () => set({ isOnline: false, lastOfflineAt: Date.now() }),
  recordStreamClose: () => set({ lastStreamCloseAt: Date.now() }),
  incrementReconnectAttempts: () => set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
}));
