import { create } from "zustand";

type ConnectionStatus = "connected" | "degraded" | "disconnected";
type StreamStatus = "connected" | "reconnecting" | "failed";

interface ConnectionState {
  status: ConnectionStatus;
  /** Herald's stream: greeted, being retried, or failed to apply what it sent. */
  globalStatus: StreamStatus;
  lastSpatialUpdate: number;
  lastGlobalUpdate: number;
  lastGlobalHandshake: number;
  lastConfirmedBlock: number | null;
  /** When the last confirmed head arrived: Herald heads a live stream every second, whether or not the world moves. */
  lastHeadAt: number;
  /** The block the store's facts were last read at by a snapshot; diffs after it reach the client on the stream. */
  snapshotBlock: number | null;
  /** Times Herald greeted the stream again after losing it. */
  reconnects: number;
  /** Losses and refused attempts since Herald last greeted the stream. */
  failedAttempts: number;
  setGlobalStatus: (status: StreamStatus) => void;
  recordSpatialUpdate: () => void;
  recordGlobalUpdate: () => void;
  recordGlobalHandshake: () => void;
  recordConfirmedHead: (block: number) => void;
  recordSnapshotBlock: (block: number) => void;
}

const statusOf = (stream: StreamStatus): ConnectionStatus =>
  stream === "failed" ? "disconnected" : stream === "connected" ? "connected" : "degraded";

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "connected",
  globalStatus: "connected",
  lastSpatialUpdate: Date.now(),
  lastGlobalUpdate: Date.now(),
  lastGlobalHandshake: 0,
  lastConfirmedBlock: null,
  lastHeadAt: 0,
  snapshotBlock: null,
  reconnects: 0,
  failedAttempts: 0,
  setGlobalStatus: (globalStatus: StreamStatus) =>
    set((state) => ({
      globalStatus,
      status: statusOf(globalStatus),
      ...(globalStatus === "reconnecting" ? { failedAttempts: state.failedAttempts + 1 } : {}),
      ...(globalStatus === "connected" && state.failedAttempts > 0
        ? { reconnects: state.reconnects + 1, failedAttempts: 0 }
        : {}),
    })),
  recordSpatialUpdate: () => set({ lastSpatialUpdate: Date.now() }),
  recordGlobalUpdate: () => set({ lastGlobalUpdate: Date.now() }),
  recordGlobalHandshake: () => {
    const now = Date.now();
    set({ lastGlobalUpdate: now, lastGlobalHandshake: now });
  },
  recordConfirmedHead: (lastConfirmedBlock) => set({ lastConfirmedBlock, lastHeadAt: Date.now() }),
  recordSnapshotBlock: (snapshotBlock) => set({ snapshotBlock }),
}));
