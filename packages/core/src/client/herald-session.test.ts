// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createManualGameSyncScheduler } from "../sync/scheduler";
import {
  buildHeraldGameStreamUrl,
  createHeraldGameSyncSession,
  type CreateHeraldGameSyncSessionInput,
} from "./herald-session";

const createSession = (overrides: Partial<CreateHeraldGameSyncSessionInput> = {}) =>
  createHeraldGameSyncSession({
    baseUrl: "https://herald.realms.test",
    chain: "madara",
    entityModels: [],
    eventModels: [],
    gameId: 54,
    scheduler: createManualGameSyncScheduler(),
    setup: { network: { contractComponents: {} } } as never,
    ...overrides,
  });

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
});

describe("createHeraldGameSyncSession", () => {
  it("reports each snapshot phase once, with its duration, and forwards real progress", () => {
    const observer = { onSnapshotPhaseStarted: vi.fn(), onSnapshotPhaseCompleted: vi.fn() };
    const onSnapshotProgress = vi.fn();
    const session = createSession({ observer, onSnapshotProgress });

    session.onSnapshotProgress?.({ completed: 1, phase: "receiving", streaming: true, total: 2 });
    session.onSnapshotProgress?.({ completed: 2, phase: "receiving", streaming: false, total: 2 });
    session.onSnapshotProgress?.({ completed: 2, phase: "receiving", streaming: false, total: 2 });
    session.onSnapshotProgress?.({ completed: 3, phase: "applying", streaming: false, total: 3 });

    expect(onSnapshotProgress).toHaveBeenCalledTimes(4);
    expect(observer.onSnapshotPhaseStarted.mock.calls).toEqual([["receiving"], ["applying"]]);
    expect(observer.onSnapshotPhaseCompleted.mock.calls.map(([phase]) => phase)).toEqual(["receiving", "applying"]);
    observer.onSnapshotPhaseCompleted.mock.calls.forEach(([, durationMs]) => {
      expect(durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  it("resets story events when the session is created and forwards stream facts to the observer", () => {
    const observer = {
      onDiffReceived: vi.fn(),
      onHead: vi.fn(),
      onLiveApplyFailed: vi.fn(),
      onRecsApplied: vi.fn(),
      onStoryEvent: vi.fn(),
      onStoryEventsReset: vi.fn(),
    };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const session = createSession({ observer });
    expect(observer.onStoryEventsReset).toHaveBeenCalledTimes(1);

    const head = { block: 13, preconfirmed: false, timestamp: 100 };
    const event = { hashed_keys: "0x1", models: {} };
    session.onHead?.(head);
    session.onEvent?.(event);
    session.onTransactionEntitiesReceived?.("0xabc");
    session.onTransactionEntitiesApplied?.("0xabc");
    session.onError?.(new Error("boom"));

    expect(observer.onHead).toHaveBeenCalledWith(head);
    expect(observer.onStoryEvent).toHaveBeenCalledWith(event);
    expect(observer.onDiffReceived).toHaveBeenCalledWith("0xabc");
    expect(observer.onRecsApplied).toHaveBeenCalledWith("0xabc");
    expect(observer.onLiveApplyFailed).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
    expect(consoleError).toHaveBeenCalledWith("[GameSync] live entity apply failed: boom");
    consoleError.mockRestore();
  });

  it("runs without an observer and uses the injected scheduler", () => {
    const scheduler = createManualGameSyncScheduler();
    const session = createSession({ scheduler });
    expect(session.scheduler).toBe(scheduler);
    expect(() =>
      session.onSnapshotProgress?.({ completed: 1, phase: "receiving", streaming: false, total: 1 }),
    ).not.toThrow();
  });
});
