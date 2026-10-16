// @vitest-environment jsdom
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { describe, expect, it } from "vitest";

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
