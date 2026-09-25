import { describe, expect, it, vi } from "vitest";
import { FactIngestQueue } from "./fact-ingest-queue";
import type { GameSyncFact, GameSyncStore } from "./game-sync-types";
import { createManualGameSyncScheduler } from "./scheduler";

const fact = (key: string, x: number | null): GameSyncFact => ({
  model: "Position",
  key,
  value: x === null ? null : { x },
});

const recordingStore = () => {
  const writes: Array<{ facts: number; retain: boolean } | { event: string }> = [];
  const store: GameSyncStore = {
    applyFacts: vi.fn((facts, retain) => writes.push({ facts: facts.length, retain: retain !== undefined })),
    applyEvent: vi.fn((event) => writes.push({ event: event.model })),
  };
  return { store, writes };
};

describe("FactIngestQueue", () => {
  it("writes in stream order, sharing a write only between plain fact steps", async () => {
    const scheduler = createManualGameSyncScheduler();
    const { store, writes } = recordingStore();
    const queue = new FactIngestQueue({ scheduler, store, now: () => 0 });

    void queue.enqueueFacts([fact("one", 1)]);
    void queue.enqueueFacts([fact("one", 2), fact("two", 5)]);
    queue.enqueueEvent({ model: "BattleEvent", key: "event", value: { winner: 1 } });
    void queue.enqueueFacts([fact("one", null)]);
    void queue.enqueueFacts([], { retain: new Map([["Position", new Set(["two"])]]) });
    void queue.enqueueFacts([fact("three", 3)]);
    const drained = queue.drain();
    scheduler.flushNext();
    await drained;

    expect(writes).toEqual([
      { facts: 3, retain: false },
      { event: "BattleEvent" },
      { facts: 1, retain: false },
      { facts: 0, retain: true },
      { facts: 1, retain: false },
    ]);
  });

  it("opens snapshot and clock gates after their preceding facts, before later diffs", async () => {
    const scheduler = createManualGameSyncScheduler();
    const writes: string[] = [];
    const store: GameSyncStore = {
      applyFacts: (facts) => {
        writes.push(`facts:${facts[0]!.key}`);
      },
      applyEvent: () => {},
      setSnapshot: (state) => {
        writes.push(`gate:${state.timestamp}`);
      },
    };
    const queue = new FactIngestQueue({ scheduler, store, now: () => 0 });
    void queue.enqueueFacts([fact("before", 1)]);
    const opened = queue.enqueueSnapshot({ gameId: 1, actor: "0x111", complete: true, timestamp: 350 });
    void queue.enqueueFacts([fact("after", 2)]);
    expect(writes).toEqual([]);
    scheduler.flushNext();
    await opened;
    await queue.drain();
    expect(writes).toEqual(["facts:before", "gate:350", "facts:after"]);
  });

  it("rejects recovery drains when a native store write fails", async () => {
    const scheduler = createManualGameSyncScheduler();
    const store: GameSyncStore = {
      applyFacts: vi.fn(() => {
        throw new Error("native store write failed");
      }),
      applyEvent: vi.fn(),
    };
    const queue = new FactIngestQueue({ scheduler, store, now: () => 0 });

    void queue.enqueueFacts([fact("one", 1)]).catch(() => undefined);
    const drained = queue.drain();
    scheduler.flushNext();

    await expect(drained).rejects.toThrow("native store write failed");
    await expect(queue.drain()).rejects.toThrow("native store write failed");
  });

  it("keeps a typical burst of small diffs in one store write", async () => {
    let nowMs = 0;
    const appliedBatches: Array<{ applyDurationMs: number; eventCount: number; operationCount: number }> = [];
    const applyFacts = vi.fn(() => {
      nowMs += 30;
    });
    const queue = new FactIngestQueue({
      scheduler: {
        schedule(task) {
          let cancelled = false;
          queueMicrotask(() => {
            if (!cancelled) task();
          });
          return () => {
            cancelled = true;
          };
        },
      },
      store: { applyFacts, applyEvent: vi.fn() },
      now: () => nowMs,
      onBatchApplied: (batch) => appliedBatches.push(batch),
    });

    for (let index = 0; index < 120; index += 1) void queue.enqueueFacts([fact(`entity-${index}`, index)]);
    await queue.drain();

    expect(applyFacts).toHaveBeenCalledTimes(1);
    expect(appliedBatches).toEqual([{ applyDurationMs: 30, eventCount: 0, operationCount: 120 }]);
  });

  it("applies the player's own action immediately in one write", async () => {
    const scheduler = createManualGameSyncScheduler();
    const { store, writes } = recordingStore();
    const queue = new FactIngestQueue({ scheduler, store, now: () => 0 });

    await queue.enqueueFacts([fact("tile", 2), fact("army", 3), fact("pending", null)], { immediate: true });

    expect(scheduler.pendingCount()).toBe(0);
    expect(writes).toEqual([{ facts: 3, retain: false }]);
  });

  it("caps shared writes but never splits one step", async () => {
    const scheduler = createManualGameSyncScheduler();
    const { store, writes } = recordingStore();
    const queue = new FactIngestQueue({ scheduler, store, now: () => 0 });

    for (let index = 0; index < 1_200; index += 1) void queue.enqueueFacts([fact(`entity-${index}`, index)]);
    void queue.enqueueFacts(Array.from({ length: 1_500 }, (_, index) => fact(`large-${index}`, index)));
    const drained = queue.drain();
    scheduler.flushNext();
    await drained;

    expect(writes).toEqual([
      { facts: 1_000, retain: false },
      { facts: 200, retain: false },
      { facts: 1_500, retain: false },
    ]);
  });
});
