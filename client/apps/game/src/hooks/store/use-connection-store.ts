import { create } from "zustand";

export type ConnectionStatus = "connected" | "degraded" | "disconnected";
export type StreamStatus = "connected" | "stale" | "reconnecting" | "failed";

interface ConnectionState {
  status: ConnectionStatus;
  spatialStatus: StreamStatus;
  globalStatus: StreamStatus;
  lastSpatialUpdate: number;
  lastGlobalUpdate: number;
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
          status !== "connected" && state.status === "connected" ? now : status === "connected" ? null : state.lastDisconnectedAt,
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
  recordSpatialUpdate: () => set({ lastSpatialUpdate: Date.now() }),
  recordGlobalUpdate: () => set({ lastGlobalUpdate: Date.now() }),
  recordHealthCheck: () => set({ lastHealthCheck: Date.now() }),
  recordStreamReconnect: () => set((state) => ({ streamReconnectVersion: state.streamReconnectVersion + 1 })),
  incrementReconnectAttempts: () => set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
}));
