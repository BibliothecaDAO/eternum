// @vitest-environment jsdom
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { clearClientActionLatency, snapshotClientActionLatency } from "@/observability/client-action-latency";
import { describe, expect, it, vi } from "vitest";

import { createGameSyncObserver as createObserver } from "./game-sync-observer";

const createGameSyncObserver = () =>
  createObserver({ reportProgress: () => undefined, onSetupCompleted: () => undefined });

const withStoreSnapshot = (run: () => void) => {
  const previous = useChainTimeStore.getState();
  const previousBlock = useConnectionStore.getState().lastConfirmedBlock;
  try {
    run();
  } finally {
    useChainTimeStore.setState(previous);
    useConnectionStore.setState({ lastConfirmedBlock: previousBlock });
  }
};

describe("createGameSyncObserver", () => {
  it("keeps each game client's sends apart, though every client numbers its sends from 1", () => {
    clearClientActionLatency();
    for (let entry = 0; entry < 3; entry += 1) {
      const observer = createGameSyncObserver();
      observer.onSendStage?.(1, "command");
      observer.onSendStage?.(1, "settled");
    }

    const sends = snapshotClientActionLatency().map((record) => record.send);
    expect(sends.map((send) => send?.stages.map(({ stage }) => stage))).toEqual([
      ["command", "settled"],
      ["command", "settled"],
      ["command", "settled"],
    ]);
    expect(new Set(sends.map((send) => send?.key)).size).toBe(3);
    clearClientActionLatency();
  });

  it("keeps the previous game's clock readable during a switch, then anchors the new game's at its first head", () => {
    withStoreSnapshot(() => {
      createGameSyncObserver().onHead?.({ block: 900, preconfirmed: false, timestamp: 2_000 });

      const nextGame = createGameSyncObserver();
      expect(useChainTimeStore.getState().getNowSeconds()).toBeGreaterThanOrEqual(2_000);
      nextGame.onHead?.({ block: 5, preconfirmed: false, timestamp: 1_000 });
      expect(Math.floor((useChainTimeStore.getState().nowMs ?? 0) / 1_000)).toBe(1_000);
    });
  });

  it("a pre-confirmed clock advances the heartbeat without moving the confirmed head", () => {
    const observer = createGameSyncObserver();
    withStoreSnapshot(() => {
      useConnectionStore.setState({ lastConfirmedBlock: 13 });
      useChainTimeStore.setState({ lastHeartbeat: { timestamp: 100_000, source: "herald-head" } });
      observer.onHead?.({ block: 14, preconfirmed: true, timestamp: 103 });
      expect(useConnectionStore.getState().lastConfirmedBlock).toBe(13);
      expect(useChainTimeStore.getState().lastHeartbeat?.timestamp).toBe(103_000);
    });
  });

  it("counts each loss of the stream until Herald greets it again, and times heads apart from data", () => {
    const connection = useConnectionStore.getState();
    vi.useFakeTimers({ now: 1_000_000 });
    withStoreSnapshot(() => {
      const observer = createGameSyncObserver();
      observer.onConnection?.(true);
      observer.onHead?.({ block: 20, preconfirmed: false, timestamp: 5 });
      expect(useConnectionStore.getState()).toMatchObject({ lastHeadAt: 1_000_000, reconnects: 0, failedAttempts: 0 });

      // A deploy recreates Herald: the stream is lost, then two attempts are refused.
      observer.onConnection?.(false);
      observer.onConnection?.(false);
      observer.onConnection?.(false);
      expect(useConnectionStore.getState()).toMatchObject({ status: "degraded", failedAttempts: 3, reconnects: 0 });

      vi.advanceTimersByTime(4_000);
      observer.onConnection?.(true);
      observer.onHead?.({ block: 21, preconfirmed: false, timestamp: 9 });
      expect(useConnectionStore.getState()).toMatchObject({
        status: "connected",
        failedAttempts: 0,
        reconnects: 1,
        lastHeadAt: 1_004_000,
      });
    });
    vi.useRealTimers();
    useConnectionStore.setState(connection);
  });

  it("writes snapshot phases to the game entry timeline as milestones and durations", () => {
    const observer = createGameSyncObserver();
    observer.onSnapshotPhaseStarted?.("receiving");
    observer.onSnapshotPhaseCompleted?.("receiving", 12.4);
    observer.onSnapshotPhaseStarted?.("applying");
    observer.onSnapshotPhaseCompleted?.("applying", 30);

    const entryWindow = window as typeof window & {
      __eternumGameEntryDurations?: Record<string, number>;
      __eternumGameEntryTimeline?: Array<{ name: string }>;
    };
    const snapshotMilestones = entryWindow.__eternumGameEntryTimeline
      ?.map(({ name }) => name)
      .filter((name) => name.startsWith("snapshot-"));
    expect(snapshotMilestones).toEqual([
      "snapshot-receive-started",
      "snapshot-receive-completed",
      "snapshot-apply-started",
      "snapshot-apply-completed",
    ]);
    expect(entryWindow.__eternumGameEntryDurations).toMatchObject({ "snapshot-receive": 12, "snapshot-apply": 30 });
  });

  it("marks the entry timeline once, when the first confirmed head anchors chain time", () => {
    const entryWindow = window as typeof window & { __eternumGameEntryTimeline?: Array<{ name: string }> };
    const anchored = () =>
      (entryWindow.__eternumGameEntryTimeline ?? []).filter(({ name }) => name === "chain-time-anchored").length;
    entryWindow.__eternumGameEntryTimeline = [];
    withStoreSnapshot(() => {
      const observer = createGameSyncObserver();
      observer.onHead?.({ block: 20, preconfirmed: true, timestamp: 300 });
      expect(anchored()).toBe(0);
      observer.onHead?.({ block: 20, preconfirmed: false, timestamp: 300 });
      observer.onHead?.({ block: 21, preconfirmed: false, timestamp: 301 });
      expect(anchored()).toBe(1);
    });
  });
});
