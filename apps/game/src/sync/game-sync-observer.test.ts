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
  it("records confirmed heads even when provisional row evidence has advanced the clock", () => {
    const observer = createGameSyncObserver();
    withStoreSnapshot(() => {
      useChainTimeStore.setState({ lastHeartbeat: { timestamp: 200_000, source: "row-evidence" } });
      observer.onHead?.({ block: 13, preconfirmed: false, timestamp: 100 });
      expect(useConnectionStore.getState().lastConfirmedBlock).toBe(13);
      expect(useChainTimeStore.getState().lastHeartbeat?.timestamp).toBe(200_000);
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
    expect(entryWindow.__eternumGameEntryTimeline?.map(({ name }) => name)).toEqual([
      "snapshot-receive-started",
      "snapshot-receive-completed",
      "snapshot-apply-started",
      "snapshot-apply-completed",
    ]);
    expect(entryWindow.__eternumGameEntryDurations).toMatchObject({ "snapshot-receive": 12, "snapshot-apply": 30 });
  });
});
