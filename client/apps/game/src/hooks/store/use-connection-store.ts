import { create } from "zustand";

export type ConnectionStatus = "connected" | "degraded" | "disconnected";

interface ConnectionState {
  status: ConnectionStatus;
  lastSpatialUpdate: number;
  lastGlobalUpdate: number;
  lastHealthCheck: number;
  reconnectAttempts: number;
  setStatus: (status: ConnectionStatus) => void;
  recordSpatialUpdate: () => void;
  recordGlobalUpdate: () => void;
  recordHealthCheck: () => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "connected",
  lastSpatialUpdate: Date.now(),
  lastGlobalUpdate: Date.now(),
  lastHealthCheck: Date.now(),
  reconnectAttempts: 0,
  setStatus: (status: ConnectionStatus) => set({ status }),
  recordSpatialUpdate: () => set({ lastSpatialUpdate: Date.now() }),
  recordGlobalUpdate: () => set({ lastGlobalUpdate: Date.now() }),
  recordHealthCheck: () => set({ lastHealthCheck: Date.now() }),
  incrementReconnectAttempts: () => set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
}));
