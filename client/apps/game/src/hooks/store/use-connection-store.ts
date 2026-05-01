import { create } from "zustand";

type ConnectionStatus = "connected" | "degraded" | "disconnected";
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
  lastHealthCheck: number;
  lastConnectedAt: number;
  lastDisconnectedAt: number | null;
  reconnectAttempts: number;
  streamReconnectVersion: number;
  setStatus: (status: ConnectionStatus) => void;
  setSpatialStatus: (status: StreamStatus) => void;
  setGlobalStatus: (status: StreamStatus) => void;
  recordSpatialUpdate: () => void;
  recordGlobalUpdate: () => void;
  recordSpatialHandshake: () => void;
  recordGlobalHandshake: () => void;
  recordToriiHeartbeat: () => void;
  markToriiHeartbeatAvailable: () => void;
  recordHealthCheck: () => void;
  recordStreamReconnect: () => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
}

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
  lastSpatialHandshake: Date.now(),
  lastGlobalHandshake: Date.now(),
  lastToriiHeartbeat: Date.now(),
  toriiHeartbeatAvailable: false,
  lastHealthCheck: Date.now(),
  lastConnectedAt: Date.now(),
  lastDisconnectedAt: null,
  reconnectAttempts: 0,
  streamReconnectVersion: 0,
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
  recordToriiHeartbeat: () => set({ lastToriiHeartbeat: Date.now(), toriiHeartbeatAvailable: true }),
  markToriiHeartbeatAvailable: () => set({ lastToriiHeartbeat: Date.now(), toriiHeartbeatAvailable: true }),
  recordHealthCheck: () => set({ lastHealthCheck: Date.now() }),
  recordStreamReconnect: () => set((state) => ({ streamReconnectVersion: state.streamReconnectVersion + 1 })),
  incrementReconnectAttempts: () => set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
}));
