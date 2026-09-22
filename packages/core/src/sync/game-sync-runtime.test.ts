import { afterEach, describe, expect, it, vi } from "vitest";
import { configManager } from "../managers/config-manager";
import {
  disposeActiveGameSyncRuntime,
  GameSyncRuntime,
  getActiveGameSyncRuntime,
  installGameSyncRuntime,
  SupersededGameSyncStartError,
} from "./game-sync-runtime";
import type {
  GameSyncEvent,
  GameSyncEventConfirmation,
  GameSyncFact,
  GameSyncFactBatch,
  GameSyncSessionStart,
  GameSyncStore,
  GameSyncSubscriptionHandlers,
  GameSyncTransaction,
  GameSyncWriter,
} from "./game-sync-types";

const fact = (key: string, model: string, value: Record<string, unknown> | null): GameSyncFact => ({
  model,
  key,
  value,
});
const event = (key: string, model: string, value: Record<string, unknown>): GameSyncEvent => ({ model, key, value });
const confirmed: GameSyncEventConfirmation = { block: 12, preconfirmed: false };
const provisional: GameSyncEventConfirmation = { block: null, preconfirmed: true };

const flushMicrotasks = async (count = 8): Promise<void> => {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
};

/** Rows by "model:key", with the native store's replacement rule; writes and events are recorded. */
const createMemoryStore = (initial: GameSyncFact[] = []) => {
  const rows = new Map<string, Record<string, unknown>>();
  const events: GameSyncEvent[] = [];
  const writes: number[] = [];
  const store: GameSyncStore = {
    applyFacts(facts, retain) {
      writes.push(facts.length);
      for (const { model, key, value } of facts) {
        if (value === null) rows.delete(`${model}:${key}`);
        else rows.set(`${model}:${key}`, value);
      }
      for (const [model, keys] of retain ?? []) {
        for (const identity of [...rows.keys()])
          if (identity.startsWith(`${model}:`) && !keys.has(identity.slice(model.length + 1))) rows.delete(identity);
      }
    },
    applyEvent(update) {
      events.push(update);
    },
  };
  store.applyFacts(initial);
  writes.length = 0;
  return { events, rows, store, writes };
};

type Snapshot = Record<string, GameSyncFact[]>;

const createSessionHarness = (input: {
  snapshot?: Snapshot;
  store?: GameSyncStore;
  transactionStatusChannel?: true;
  /** Runs inside subscribe, after the handlers are known and before the snapshot is sent. */
  beforeSnapshot?: (handlers: GameSyncSubscriptionHandlers) => void;
  sendSnapshot?: boolean;
}) => {
  const order: string[] = [];
  const writers: Array<GameSyncWriter & { cancel: ReturnType<typeof vi.fn> }> = [];
  let handlers: GameSyncSubscriptionHandlers | null = null;
  let snapshot = input.snapshot ?? {};
  let failNextSnapshot: Error | null = null;

  const sendSnapshot = (models: Snapshot) => {
    handlers!.onSnapshotStart();
    let modelsReceived = 0;
    for (const [model, facts] of Object.entries(models)) {
      modelsReceived += 1;
      order.push(`snapshot-${model}`);
      handlers!.onSnapshotModel(model, facts, {
        bytesReceived: 1,
        model,
        modelsReceived,
        rowsReceived: facts.length,
      });
      if (failNextSnapshot) {
        const failure = failNextSnapshot;
        failNextSnapshot = null;
        handlers!.onStartFailure(failure);
        return;
      }
    }
    handlers!.onSnapshotEnd();
  };

  const session: GameSyncSessionStart = {
    snapshotModels: ["Position", "Stats", "ActionNonce"],
    store: input.store ?? createMemoryStore().store,
    transport: {
      transactionStatusChannel: input.transactionStatusChannel,
      async subscribe(nextHandlers) {
        order.push("subscribe-active");
        handlers = nextHandlers;
        const writer = { cancel: vi.fn() };
        writers.push(writer);
        input.beforeSnapshot?.(nextHandlers);
        if (input.sendSnapshot !== false) sendSnapshot(snapshot);
        return writer;
      },
    },
  };

  return {
    emitFacts(batch: GameSyncFactBatch) {
      handlers?.onFacts(batch);
    },
    emitEvent(update: GameSyncEvent, confirmation: GameSyncEventConfirmation = { block: null, preconfirmed: false }) {
      handlers?.onEvent(update, confirmation);
    },
    emitScope(facts: GameSyncFact[], expedition = false) {
      handlers?.onScope(facts, expedition);
    },
    emitSnapshot: sendSnapshot,
    emitTransaction(transaction: GameSyncTransaction) {
      handlers?.onTransaction(transaction);
    },
    failNextSnapshot(error: Error) {
      failNextSnapshot = error;
    },
    order,
    resetSnapshot(next: Snapshot) {
      snapshot = next;
    },
    session,
    writers,
  };
};

afterEach(() => disposeActiveGameSyncRuntime());

describe("GameSyncRuntime recovery", () => {
  it("activates the subscription before hydrating every snapshot model", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({
      store: memory.store,
      snapshot: {
        Position: [fact("one", "Position", { x: 1 })],
        Stats: [fact("two", "Stats", { hp: 2 })],
      },
    });
    const runtime = new GameSyncRuntime();
    const snapshotProgress = vi.fn();
    harness.session.onSnapshotProgress = snapshotProgress;

    await runtime.startSession(harness.session);

    expect(harness.order).toEqual(["subscribe-active", "snapshot-Position", "snapshot-Stats"]);
    expect([...memory.rows.keys()]).toEqual(["Position:one", "Stats:two"]);
    expect(runtime.getMetrics()).toMatchObject({ snapshotEntityCount: 2, snapshotPageCount: 2 });
    expect(snapshotProgress).toHaveBeenLastCalledWith({ completed: 2, phase: "applying", streaming: false, total: 2 });
    expect(runtime.getStatus()).toBe("running");
  });

  it("applies a submitted transaction on arrival and reports both latency boundaries", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({ store: memory.store, transactionStatusChannel: true });
    const received = vi.fn();
    const applied = vi.fn();
    harness.session.onTransactionEntitiesReceived = received;
    harness.session.onTransactionEntitiesApplied = applied;
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);
    runtime.recordSubmittedTransaction("0x0abc");
    const writesBefore = memory.writes.length;

    harness.emitFacts({
      facts: [fact("army", "ExplorerTroops", { x: 4 }), fact("tile", "TileOpt", { biome: 2 })],
      preconfirmed: true,
      transactionHash: "0xabc",
    });
    await flushMicrotasks();

    expect(memory.rows.get("ExplorerTroops:army")).toEqual({ x: 4 });
    expect(memory.rows.get("TileOpt:tile")).toEqual({ biome: 2 });
    expect(memory.writes.slice(writesBefore)).toEqual([2]);
    expect(received).toHaveBeenCalledWith("0xabc");
    expect(applied).toHaveBeenCalledWith("0xabc");
  });

  it("stops the live session and reports one actionable error when an atomic batch cannot apply", async () => {
    const failure = new Error("native store write failed");
    const store = createMemoryStore().store;
    const harness = createSessionHarness({ store });
    const onError = vi.fn();
    harness.session.onError = onError;
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);
    store.applyFacts = () => {
      throw failure;
    };

    harness.emitFacts({
      facts: [fact("army", "ExplorerTroops", { x: 4 })],
      preconfirmed: true,
      transactionHash: "0xabc",
    });
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(failure);
    expect(harness.writers[0]?.cancel).toHaveBeenCalledOnce();
    expect(runtime.getStatus()).toBe("stopped");
  });

  it("applies the diffs that follow the snapshot in stream order", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({
      store: memory.store,
      snapshot: { Position: [fact("army", "Position", { x: 1 })] },
    });
    await new GameSyncRuntime().startSession(harness.session);
    harness.emitFacts({ facts: [fact("army", "Position", { x: 2 })], preconfirmed: true });
    harness.emitFacts({ facts: [fact("army", "Position", { x: 3 })], preconfirmed: false });
    await flushMicrotasks();

    expect(memory.rows.get("Position:army")).toEqual({ x: 3 });
  });

  it("removes one model's row without touching another model at the same key", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({
      store: memory.store,
      snapshot: { Position: [fact("army", "Position", { x: 1 })], Stats: [fact("army", "Stats", { health: 5 })] },
    });
    await new GameSyncRuntime().startSession(harness.session);

    harness.emitFacts({ facts: [fact("army", "Position", null)], preconfirmed: false });
    await flushMicrotasks();

    expect([...memory.rows.entries()]).toEqual([["Stats:army", { health: 5 }]]);
  });

  it("removes the rows a snapshot no longer lists without touching the rows it keeps", async () => {
    const memory = createMemoryStore([fact("army", "Position", { x: 9 }), fact("army", "Stats", { health: 5 })]);
    const harness = createSessionHarness({
      store: memory.store,
      snapshot: { Position: [], Stats: [fact("army", "Stats", { health: 6 })] },
    });

    await new GameSyncRuntime().startSession(harness.session);

    expect([...memory.rows.entries()]).toEqual([["Stats:army", { health: 6 }]]);
  });

  it("replaces the store in one write when a running session receives a fresh snapshot", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({
      store: memory.store,
      snapshot: {
        Position: [fact("one", "Position", { x: 1 }), fact("two", "Position", { x: 2 })],
        Stats: [fact("one", "Stats", { hp: 1 })],
      },
    });
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);
    const writesBefore = memory.writes.length;

    harness.emitSnapshot({ Position: [fact("one", "Position", { x: 1 }), fact("three", "Position", { x: 3 })] });
    await flushMicrotasks();

    expect(memory.writes.slice(writesBefore)).toEqual([2]);
    expect([...memory.rows.entries()]).toEqual([
      ["Position:one", { x: 1 }],
      ["Position:three", { x: 3 }],
    ]);
  });

  it("replaces only the actor-scoped rows when the actor changes", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({
      store: memory.store,
      snapshot: {
        Structure: [fact("realm", "Structure", { entity_id: 1 })],
        ActionNonce: [fact("first", "ActionNonce", { next_nonce: 4 })],
      },
    });
    harness.session.snapshotModels = ["Structure", "ActionNonce"];
    await new GameSyncRuntime().startSession(harness.session);

    harness.emitScope([fact("second", "ActionNonce", { next_nonce: 0 })]);
    await flushMicrotasks();

    expect([...memory.rows.entries()]).toEqual([
      ["Structure:realm", { entity_id: 1 }],
      ["ActionNonce:second", { next_nonce: 0 }],
    ]);
  });

  it("reruns the same recovery after a connection loss during the snapshot", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({
      store: memory.store,
      snapshot: { Position: [fact("one", "Position", { x: 1 })], Stats: [fact("two", "Stats", { hp: 2 })] },
    });
    harness.failNextSnapshot(new Error("connection lost"));
    const runtime = new GameSyncRuntime();

    await expect(runtime.startSession(harness.session)).rejects.toThrow("connection lost");
    expect(runtime.getStatus()).toBe("stopped");

    harness.resetSnapshot({
      Position: [fact("one", "Position", { x: 10 })],
      Stats: [fact("two", "Stats", { hp: 20 })],
    });
    await runtime.recover();

    expect(memory.rows.get("Position:one")).toEqual({ x: 10 });
    expect(memory.rows.get("Stats:two")).toEqual({ hp: 20 });
    expect(harness.writers[0].cancel).toHaveBeenCalledOnce();
  });

  it("fences callbacks and late writers from a superseded generation", async () => {
    const memory = createMemoryStore();
    const runtime = new GameSyncRuntime();
    let oldHandlers!: GameSyncSubscriptionHandlers;
    let resolveOldWriter!: (writer: GameSyncWriter) => void;
    const lateWriter = { cancel: vi.fn() };
    const oldStart = runtime.startSession({
      snapshotModels: ["Position"],
      store: memory.store,
      transport: {
        subscribe: (handlers) => {
          oldHandlers = handlers;
          return new Promise((resolve) => (resolveOldWriter = resolve));
        },
      },
    });
    const nextHarness = createSessionHarness({ store: memory.store });

    await runtime.startSession(nextHarness.session);
    oldHandlers.onFacts({ facts: [fact("old", "Position", { x: 99 })], preconfirmed: false });
    resolveOldWriter(lateWriter);
    await flushMicrotasks();

    await expect(oldStart).rejects.toBeInstanceOf(SupersededGameSyncStartError);
    expect(lateWriter.cancel).toHaveBeenCalledOnce();
    expect(memory.rows.has("Position:old")).toBe(false);
  });

  it("deduplicates event effects across recovery without storing event rows", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({ store: memory.store });
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);

    const battle = event("event-1", "BattleEvent", { timestamp: 100, winner: 1 });
    harness.emitEvent(battle);
    await flushMicrotasks();
    await runtime.recover();
    harness.emitEvent(battle);
    harness.emitEvent(event("event-2", "BattleEvent", { timestamp: 101, winner: 2 }));
    await flushMicrotasks();

    expect(memory.events.map(({ key }) => key)).toEqual(["event-1", "event-2"]);
    expect([...memory.rows.keys()].some((identity) => identity.startsWith("BattleEvent:"))).toBe(false);
  });

  it("promotes a provisional event to confirmed once without replaying effects or downgrading it", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({ store: memory.store });
    harness.session.onEvent = vi.fn();
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);
    const pending = event("story-1", "StoryEvent", { timestamp: 100 });
    const settled = event("story-1", "StoryEvent", { timestamp: 101 });
    harness.emitEvent(pending, provisional);
    harness.emitEvent(settled, confirmed);
    harness.emitEvent(pending, provisional);
    harness.emitEvent(pending, { block: null, preconfirmed: false });
    await flushMicrotasks();
    await runtime.recover();
    harness.emitEvent(settled, confirmed);
    await flushMicrotasks();
    expect(harness.session.onEvent).toHaveBeenCalledTimes(2);
    expect(harness.session.onEvent).toHaveBeenLastCalledWith(settled, confirmed);
    expect(memory.events).toHaveLength(1);
  });

  it("identifies timestamp-free native events by transaction position across confirmation and recovery", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({ store: memory.store });
    harness.session.onEvent = vi.fn();
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);
    const award = (index: number, hash = "0x123") =>
      event("award", "PointsAwarded", {
        points: "0x10",
        event_position: { transaction_hash: hash, event_index: index },
      });
    harness.emitEvent(award(3), provisional);
    harness.emitEvent(award(3, "0x0123"), confirmed);
    harness.emitEvent(award(4), confirmed);
    harness.emitEvent(award(3, "0x124"), confirmed);
    await flushMicrotasks();
    await runtime.recover();
    harness.emitEvent(award(3), confirmed);
    await flushMicrotasks();
    expect(harness.session.onEvent).toHaveBeenCalledTimes(4);
    expect(memory.events).toHaveLength(3);
  });

  it("keeps delivering the diff when a session event handler throws", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({ store: memory.store });
    harness.session.onEvent = () => {
      throw new Error("malformed story");
    };
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => harness.emitEvent(event("event-1", "BattleEvent", { timestamp: 100, winner: 1 }))).not.toThrow();
    await flushMicrotasks();

    expect(memory.events.map(({ key }) => key)).toEqual(["event-1"]);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("applies repeat events for the same on-chain key when their timestamps differ", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({ store: memory.store });
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);

    harness.emitEvent(event("same-participants", "BattleEvent", { timestamp: 100, winner: 1 }));
    harness.emitEvent(event("same-participants", "BattleEvent", { timestamp: 101, winner: 2 }));
    await flushMicrotasks();

    expect(memory.events.map(({ value }) => value)).toEqual([
      { timestamp: 100, winner: 1 },
      { timestamp: 101, winner: 2 },
    ]);
  });

  it("uses a fixed FIFO for event identities", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({ store: memory.store });
    harness.session.eventIdentityLimit = 2;
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);

    harness.emitEvent(event("event-1", "BattleEvent", { timestamp: 100, winner: 1 }));
    harness.emitEvent(event("event-2", "BattleEvent", { timestamp: 101, winner: 2 }));
    harness.emitEvent(event("event-3", "BattleEvent", { timestamp: 102, winner: 3 }));
    await flushMicrotasks();
    harness.emitEvent(event("event-1", "BattleEvent", { timestamp: 100, winner: 1 }));
    await flushMicrotasks();

    expect(memory.events.map(({ key }) => key)).toEqual(["event-1", "event-2", "event-3", "event-1"]);
  });
});

describe("GameSyncRuntime lifecycle", () => {
  it("resolves and rejects transaction waits from the stream channel", async () => {
    const harness = createSessionHarness({ transactionStatusChannel: true });
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);

    const accepted = runtime.waitForTransaction("0x00abc");
    harness.emitTransaction({ block: null, hash: "0xabc", status: "PRE_CONFIRMED" });
    await expect(accepted).resolves.toMatchObject({ hash: "0xabc", status: "PRE_CONFIRMED" });
    await expect(runtime.waitForTransaction("0xabc")).resolves.toMatchObject({ hash: "0xabc" });

    const reverted = runtime.waitForTransaction("0xdef");
    harness.emitTransaction({ block: null, hash: "0x0def", revertReason: "game rule", status: "REVERTED" });
    await expect(reverted).rejects.toThrow("game rule");
  });

  it("waits for scheduled rows before publishing a transaction status or releasing its waiters", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({ store: memory.store, transactionStatusChannel: true });
    let flush: (() => void) | undefined;
    harness.session.scheduler = {
      schedule: (task) => {
        flush = task;
        return () => {};
      },
    };
    const published = vi.fn();
    harness.session.onTransaction = published;
    const runtime = new GameSyncRuntime();
    const started = runtime.startSession(harness.session);
    await flushMicrotasks();
    flush!();
    await started;
    const completed = vi.fn();
    const wait = runtime.waitForTransaction("0xabc").then(completed);
    harness.emitFacts({
      facts: [fact("player", "ActionNonce", { next_nonce: 2 })],
      preconfirmed: true,
      transactionHash: "0xabc",
    });
    harness.emitTransaction({ block: null, hash: "0xabc", status: "PRE_CONFIRMED" });
    await flushMicrotasks();
    expect(completed).not.toHaveBeenCalled();
    expect(published).not.toHaveBeenCalled();
    flush!();
    await wait;
    expect(memory.rows.get("ActionNonce:player")).toEqual({ next_nonce: 2 });
    expect(published).toHaveBeenCalledOnce();
  });

  it("refuses transaction waits when the transport has no status channel", async () => {
    const harness = createSessionHarness({});
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);

    await expect(runtime.waitForTransaction("0xabc")).rejects.toThrow("no transaction status channel");
  });

  it("owns and replaces the session spatial projection", () => {
    const runtime = new GameSyncRuntime();
    const first = { dispose: vi.fn(), start: vi.fn(), subscribe: vi.fn(() => () => undefined) };
    const second = { dispose: vi.fn(), start: vi.fn(), subscribe: vi.fn(() => () => undefined) };

    runtime.installWorldSpatialProjection(first as never);
    runtime.installWorldSpatialProjection(second as never);

    expect(first.start).toHaveBeenCalledOnce();
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.start).toHaveBeenCalledOnce();
    expect(runtime.requireWorldSpatialProjection()).toBe(second);

    runtime.dispose();
    expect(second.dispose).toHaveBeenCalledOnce();
  });

  it("does not retain a spatial projection that fails to start", () => {
    const runtime = new GameSyncRuntime();
    const projection = {
      dispose: vi.fn(),
      start: vi.fn(() => {
        throw new Error("projection failed");
      }),
      subscribe: vi.fn(() => () => undefined),
    };

    expect(() => runtime.installWorldSpatialProjection(projection as never)).toThrow("projection failed");
    expect(projection.dispose).toHaveBeenCalledOnce();
    expect(() => runtime.requireWorldSpatialProjection()).toThrow("has not been installed");
  });

  it("preserves the cancellation guard but force-cancels on dispose", async () => {
    const runtime = new GameSyncRuntime();
    const harness = createSessionHarness({ sendSnapshot: false });
    const start = runtime.startSession(harness.session);
    await flushMicrotasks();

    runtime.cancelGlobalWriter();
    expect(harness.writers[0].cancel).not.toHaveBeenCalled();
    runtime.dispose();
    expect(harness.writers[0].cancel).toHaveBeenCalledOnce();
    harness.emitSnapshot({});
    await expect(start).rejects.toBeInstanceOf(SupersededGameSyncStartError);
  });

  it("tears down the previous session when the active game changes", async () => {
    const runtime = installGameSyncRuntime(new GameSyncRuntime());
    const harness = createSessionHarness({});
    await runtime.startSession(harness.session);

    configManager.setActiveGame(14, 6);

    expect(harness.writers[0].cancel).toHaveBeenCalledOnce();
    expect(getActiveGameSyncRuntime()).toBeNull();
  });
});
