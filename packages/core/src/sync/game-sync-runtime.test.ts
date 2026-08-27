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
  GameSyncEntity,
  GameSyncEntityStoreOperation,
  GameSyncSessionStart,
  GameSyncStore,
  GameSyncSubscriptionHandlers,
  GameSyncTransaction,
  GameSyncWriter,
} from "./game-sync-types";

const entity = (id: string, models: Record<string, unknown>): GameSyncEntity => ({ hashed_keys: id, models });

const flushMicrotasks = async (count = 8): Promise<void> => {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
};

const createMemoryStore = (initial: Record<string, Record<string, unknown>> = {}) => {
  const rows = new Map(Object.entries(initial).map(([id, models]) => [id, { ...models }]));
  const events: GameSyncEntity[] = [];
  const operations: GameSyncEntityStoreOperation[] = [];

  const store: GameSyncStore = {
    applyEntityOperations(nextOperations) {
      operations.push(...nextOperations);
      nextOperations.forEach((operation) => {
        if (operation.type === "upsert") {
          operation.entities.forEach((update) => {
            rows.set(update.hashed_keys, { ...rows.get(update.hashed_keys), ...update.models });
          });
        } else if (operation.type === "remove-components") {
          const models = rows.get(operation.entityId);
          operation.models.forEach((model) => {
            delete models?.[model];
          });
        } else {
          rows.delete(operation.entityId);
        }
      });
    },
    applyEvent(eventUpdate) {
      events.push(eventUpdate);
    },
    listModelEntityIds(model) {
      return [...rows].filter(([, models]) => model in models).map(([id]) => id);
    },
  };

  return { events, operations, rows, store };
};

const createSessionHarness = (input: {
  pages?: Array<{ items: GameSyncEntity[]; nextCursor?: string }>;
  store?: GameSyncStore;
  transactionStatusChannel?: true;
  onFetchPage?: (pageIndex: number, handlers: GameSyncSubscriptionHandlers) => void | Promise<void>;
}) => {
  const order: string[] = [];
  const writers: Array<GameSyncWriter & { cancel: ReturnType<typeof vi.fn> }> = [];
  let handlers: GameSyncSubscriptionHandlers | null = null;
  let pageIndex = 0;
  let pages = input.pages ?? [{ items: [] }];

  const session: GameSyncSessionStart = {
    snapshotModels: ["Position", "Stats"],
    store: input.store ?? createMemoryStore().store,
    transport: {
      transactionStatusChannel: input.transactionStatusChannel,
      async subscribe(nextHandlers) {
        order.push("subscribe-active");
        handlers = nextHandlers;
        const nextWriter = { cancel: vi.fn() };
        writers.push(nextWriter);
        return nextWriter;
      },
      async fetchSnapshotPage() {
        order.push(`snapshot-page-${pageIndex + 1}`);
        await input.onFetchPage?.(pageIndex, handlers!);
        return pages[pageIndex++] ?? { items: [] };
      },
    },
  };

  return {
    emitEntity(update: GameSyncEntity) {
      handlers?.onEntity(update);
    },
    emitEvent(update: GameSyncEntity) {
      handlers?.onEvent(update);
    },
    emitTransaction(transaction: GameSyncTransaction) {
      handlers?.onTransaction?.(transaction);
    },
    recordEventGapFill(replayedEventCount: number) {
      handlers?.onEventGapFill(replayedEventCount);
    },
    order,
    resetPages(nextPages: typeof pages) {
      pages = nextPages;
      pageIndex = 0;
    },
    session,
    writers,
  };
};

afterEach(() => disposeActiveGameSyncRuntime());

describe("GameSyncRuntime recovery", () => {
  it("activates subscriptions before hydrating every snapshot page", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({
      store: memory.store,
      pages: [
        { items: [entity("one", { Position: { x: 1 } })], nextCursor: "page-2" },
        { items: [entity("two", { Position: { x: 2 } })] },
      ],
    });
    const runtime = new GameSyncRuntime();

    await runtime.startSession(harness.session);

    expect(harness.order).toEqual(["subscribe-active", "snapshot-page-1", "snapshot-page-2"]);
    expect([...memory.rows.keys()]).toEqual(["one", "two"]);
    expect(runtime.getMetrics()).toMatchObject({ snapshotEntityCount: 2, snapshotPageCount: 2 });
    expect(runtime.getStatus()).toBe("running");
  });

  it("routes targeted authoritative queries through the active ingest queue", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({ store: memory.store });
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);

    await runtime.applyAuthoritativeEntities([entity("queried-army", { ExplorerTroops: { coord: { x: 12, y: 9 } } })]);

    expect(memory.rows.get("queried-army")).toEqual({ ExplorerTroops: { coord: { x: 12, y: 9 } } });
    expect(memory.operations.at(-1)).toEqual({
      type: "upsert",
      entities: [entity("queried-army", { ExplorerTroops: { coord: { x: 12, y: 9 } } })],
    });
  });

  it("replays live updates in client receive order after the snapshot", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({
      store: memory.store,
      pages: [{ items: [entity("army", { Position: { x: 1 } })] }],
      onFetchPage: (_pageIndex, handlers) => {
        handlers.onEntity(entity("army", { Position: { x: 2 } }));
        handlers.onEntity(entity("army", { Position: { x: 3 } }));
      },
    });

    await new GameSyncRuntime().startSession(harness.session);

    expect(memory.rows.get("army")?.Position).toEqual({ x: 3 });
  });

  it("applies component tombstones without deleting sibling components", async () => {
    const memory = createMemoryStore({ army: { Position: { x: 1 }, Stats: { health: 5 } } });
    const harness = createSessionHarness({
      store: memory.store,
      pages: [{ items: [entity("army", { Position: { x: 1 }, Stats: { health: 5 } })] }],
    });
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);

    harness.emitEntity(entity("army", { Position: {} }));
    await Promise.resolve();
    await Promise.resolve();

    expect(memory.rows.get("army")).toEqual({ Stats: { health: 5 } });
  });

  it("diffs absent snapshot components without deleting siblings", async () => {
    const memory = createMemoryStore({ army: { Position: { x: 9 }, Stats: { health: 5 } } });
    const harness = createSessionHarness({
      store: memory.store,
      pages: [{ items: [entity("army", { Stats: { health: 6 } })] }],
    });

    await new GameSyncRuntime().startSession(harness.session);

    expect(memory.rows.get("army")).toEqual({ Stats: { health: 6 } });
  });

  it("reruns the same recovery after a connection loss during pagination", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({
      store: memory.store,
      pages: [
        { items: [entity("one", { Position: { x: 1 } })], nextCursor: "page-2" },
        { items: [entity("two", { Position: { x: 2 } })] },
      ],
    });
    const originalFetch = harness.session.transport.fetchSnapshotPage;
    let failSecondPage = true;
    harness.session.transport.fetchSnapshotPage = async (cursor) => {
      if (cursor && failSecondPage) throw new Error("connection lost");
      return originalFetch(cursor);
    };
    const runtime = new GameSyncRuntime();

    await expect(runtime.startSession(harness.session)).rejects.toThrow("connection lost");
    expect(runtime.getStatus()).toBe("stopped");

    failSecondPage = false;
    harness.resetPages([
      { items: [entity("one", { Position: { x: 10 } })], nextCursor: "page-2" },
      { items: [entity("two", { Position: { x: 20 } })] },
    ]);
    await runtime.recover();

    expect(memory.rows.get("one")?.Position).toEqual({ x: 10 });
    expect(memory.rows.get("two")?.Position).toEqual({ x: 20 });
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
        fetchSnapshotPage: async () => ({ items: [] }),
      },
    });
    const nextHarness = createSessionHarness({ store: memory.store });

    await runtime.startSession(nextHarness.session);
    oldHandlers.onEntity(entity("old", { Position: { x: 99 } }));
    resolveOldWriter(lateWriter);

    await expect(oldStart).rejects.toBeInstanceOf(SupersededGameSyncStartError);
    expect(lateWriter.cancel).toHaveBeenCalledOnce();
    expect(memory.rows.has("old")).toBe(false);
  });

  it("deduplicates event effects across recovery without snapshotting event rows", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({ store: memory.store });
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);

    const battle = entity("event-1", { BattleEvent: { timestamp: 100, winner: 1 } });
    harness.emitEvent(battle);
    await Promise.resolve();
    await Promise.resolve();
    await runtime.recover();
    harness.emitEvent(battle);
    harness.emitEvent(entity("event-2", { BattleEvent: { timestamp: 101, winner: 2 } }));
    await Promise.resolve();
    await Promise.resolve();

    expect(memory.events.map(({ hashed_keys }) => hashed_keys)).toEqual(["event-1", "event-2"]);
    expect([...memory.rows.values()].some((models) => "BattleEvent" in models)).toBe(false);
  });

  it("applies repeat events for the same on-chain key when their timestamps differ", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({ store: memory.store });
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);

    harness.emitEvent(entity("same-participants", { BattleEvent: { timestamp: 100, winner: 1 } }));
    harness.emitEvent(
      entity("same-participants", {
        BattleEvent: {
          timestamp: { key: false, type: "primitive", type_name: "u64", value: 101 },
          winner: 2,
        },
      }),
    );
    await flushMicrotasks();

    expect(memory.events.map(({ models }) => models.BattleEvent)).toEqual([
      { timestamp: 100, winner: 1 },
      {
        timestamp: { key: false, type: "primitive", type_name: "u64", value: 101 },
        winner: 2,
      },
    ]);
  });

  it("uses a fixed FIFO for event identities", async () => {
    const memory = createMemoryStore();
    const harness = createSessionHarness({ store: memory.store });
    harness.session.eventIdentityLimit = 2;
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);

    harness.emitEvent(entity("event-1", { BattleEvent: { timestamp: 100, winner: 1 } }));
    harness.emitEvent(entity("event-2", { BattleEvent: { timestamp: 101, winner: 2 } }));
    harness.emitEvent(entity("event-3", { BattleEvent: { timestamp: 102, winner: 3 } }));
    await flushMicrotasks();
    harness.emitEvent(entity("event-1", { BattleEvent: { timestamp: 100, winner: 1 } }));
    await flushMicrotasks();

    expect(memory.events.map(({ hashed_keys }) => hashed_keys)).toEqual(["event-1", "event-2", "event-3", "event-1"]);
  });

  it("reports event gap-fill replay counts in runtime metrics", async () => {
    const harness = createSessionHarness({});
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);

    harness.recordEventGapFill(3);
    harness.recordEventGapFill(2);

    expect(runtime.getMetrics()).toMatchObject({
      eventGapFillReplayCount: 2,
      totalReplayedEventUpdates: 5,
    });
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

  it("refuses transaction waits when the transport has no status channel", async () => {
    const harness = createSessionHarness({});
    const runtime = new GameSyncRuntime();
    await runtime.startSession(harness.session);

    await expect(runtime.waitForTransaction("0xabc")).rejects.toThrow("no transaction status channel");
  });

  it("owns and replaces the session spatial projection", () => {
    const runtime = new GameSyncRuntime();
    const first = { start: vi.fn(), dispose: vi.fn() };
    const second = { start: vi.fn(), dispose: vi.fn() };

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
      start: vi.fn(() => {
        throw new Error("projection failed");
      }),
      dispose: vi.fn(),
    };

    expect(() => runtime.installWorldSpatialProjection(projection as never)).toThrow("projection failed");
    expect(projection.dispose).toHaveBeenCalledOnce();
    expect(() => runtime.requireWorldSpatialProjection()).toThrow("has not been installed");
  });

  it("preserves the cancellation guard but force-cancels on dispose", async () => {
    const runtime = new GameSyncRuntime();
    let finishSnapshot!: () => void;
    const harness = createSessionHarness({
      async onFetchPage() {
        await new Promise<void>((resolve) => (finishSnapshot = resolve));
      },
    });
    const start = runtime.startSession(harness.session);
    await flushMicrotasks();

    runtime.cancelGlobalWriter();
    expect(harness.writers[0].cancel).not.toHaveBeenCalled();
    runtime.dispose();
    expect(harness.writers[0].cancel).toHaveBeenCalledOnce();
    finishSnapshot();
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

  it("rejects buffered updates from the previous game when the active game changes", async () => {
    const memory = createMemoryStore();
    let finishSnapshot!: () => void;
    const snapshotBlocked = new Promise<void>((resolve) => (finishSnapshot = resolve));
    const harness = createSessionHarness({
      store: memory.store,
      pages: [{ items: [] }],
      async onFetchPage(_pageIndex, handlers) {
        handlers.onEntity(entity("old-game-army", { Position: { x: 99 } }));
        await snapshotBlocked;
      },
    });
    const runtime = installGameSyncRuntime(new GameSyncRuntime());
    const start = runtime.startSession(harness.session);
    await flushMicrotasks();

    configManager.setActiveGame(15, 7);
    finishSnapshot();

    await expect(start).rejects.toBeInstanceOf(SupersededGameSyncStartError);
    expect(memory.rows.has("old-game-army")).toBe(false);
    expect(harness.writers[0].cancel).toHaveBeenCalledOnce();
  });
});
