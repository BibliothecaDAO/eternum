// @vitest-environment jsdom
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { describe, expect, it, vi } from "vitest";

import { buildHeraldGameStreamUrl, createHeraldGameSyncSession } from "./herald-game-sync-session";

describe("buildHeraldGameStreamUrl", () => {
  it("builds the per-chain, per-game WebSocket endpoint", () => {
    expect(buildHeraldGameStreamUrl("https://herald.realms.test/stream/", "madara", 54)).toBe(
      "wss://herald.realms.test/stream/madara/games/54",
    );
    expect(buildHeraldGameStreamUrl("ws://127.0.0.1:3003", "appchain", 7)).toBe("ws://127.0.0.1:3003/appchain/games/7");
  });

  it("rejects a missing game scope", () => {
    expect(() => buildHeraldGameStreamUrl("https://herald.realms.test", "madara", 0)).toThrow("positive game id");
  });

  it("records snapshot receive/apply phases and forwards real progress", () => {
    const onSnapshotProgress = vi.fn();
    const session = createHeraldGameSyncSession({
      baseUrl: "https://herald.realms.test",
      chain: "madara",
      entityModels: [],
      eventModels: [],
      gameId: 54,
      worldAddress: "0xabc",
      onSnapshotProgress,
      setup: { network: { contractComponents: {} } } as never,
    });

    session.onSnapshotProgress?.({ completed: 1, phase: "receiving", streaming: true, total: 2 });
    session.onSnapshotProgress?.({ completed: 2, phase: "receiving", streaming: false, total: 2 });
    session.onSnapshotProgress?.({ completed: 3, phase: "applying", streaming: false, total: 3 });

    expect(onSnapshotProgress).toHaveBeenCalledTimes(3);
    expect(
      (
        window as typeof window & { __eternumGameEntryTimeline?: Array<{ name: string }> }
      ).__eternumGameEntryTimeline?.map(({ name }) => name),
    ).toEqual([
      "snapshot-receive-started",
      "snapshot-receive-completed",
      "snapshot-apply-started",
      "snapshot-apply-completed",
    ]);
  });
});

it("records confirmed heads even when provisional row evidence has advanced the clock", () => {
  const session = createHeraldGameSyncSession({
    baseUrl: "https://herald.realms.test",
    chain: "madara",
    entityModels: [],
    eventModels: [],
    gameId: 54,
    worldAddress: "0xabc",
    setup: { network: { contractComponents: {} } } as never,
  });
  const previous = useChainTimeStore.getState();
  const previousBlock = useConnectionStore.getState().lastConfirmedBlock;
  try {
    useChainTimeStore.setState({ lastHeartbeat: { timestamp: 200_000, source: "row-evidence" } });
    session.onHead?.({ block: 13, preconfirmed: false, timestamp: 100 });
    expect(useConnectionStore.getState().lastConfirmedBlock).toBe(13);
    expect(useChainTimeStore.getState().lastHeartbeat?.timestamp).toBe(200_000);
  } finally {
    useChainTimeStore.setState(previous);
    useConnectionStore.setState({ lastConfirmedBlock: previousBlock });
  }
});

it("a pre-confirmed clock advances the heartbeat without moving the confirmed head", () => {
  const session = createHeraldGameSyncSession({
    baseUrl: "https://herald.realms.test",
    chain: "madara",
    entityModels: [],
    eventModels: [],
    gameId: 54,
    worldAddress: "0xabc",
    setup: { network: { contractComponents: {} } } as never,
  });
  const previous = useChainTimeStore.getState();
  const previousBlock = useConnectionStore.getState().lastConfirmedBlock;
  try {
    useConnectionStore.setState({ lastConfirmedBlock: 13 });
    useChainTimeStore.setState({ lastHeartbeat: { timestamp: 100_000, source: "herald-head" } });
    session.onHead?.({ block: 14, preconfirmed: true, timestamp: 103 });
    expect(useConnectionStore.getState().lastConfirmedBlock).toBe(13);
    expect(useChainTimeStore.getState().lastHeartbeat?.timestamp).toBe(103_000);
  } finally {
    useChainTimeStore.setState(previous);
    useConnectionStore.setState({ lastConfirmedBlock: previousBlock });
  }
});
