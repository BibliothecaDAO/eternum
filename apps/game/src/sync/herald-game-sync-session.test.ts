// @vitest-environment jsdom
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
      logging: false,
      onSnapshotProgress,
      setup: { network: { contractComponents: {} } } as never,
    });

    session.onSnapshotProgress?.({ completed: 1, phase: "receiving", total: 2 });
    session.onSnapshotProgress?.({ completed: 2, phase: "receiving", total: 2 });
    session.onSnapshotProgress?.({ completed: 3, phase: "applying", total: 3 });

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
