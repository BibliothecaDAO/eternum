import { afterEach, describe, expect, it, vi } from "vitest";

import { HeraldGameSyncTransport, type HeraldSocket } from "./herald-game-sync-transport";
import type { GameSyncEntity, GameSyncSubscriptionHandlers, GameSyncTransaction } from "./game-sync-types";

class FakeSocket implements HeraldSocket {
  public onclose: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public onmessage: ((event: { data: unknown }) => void) | null = null;
  public onopen: (() => void) | null = null;
  public readonly sent: Array<Record<string, unknown>> = [];
  public closed = false;

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }

  public send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  public receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const streamHarness = () => {
  const sockets: FakeSocket[] = [];
  const entities: GameSyncEntity[] = [];
  const events: GameSyncEntity[] = [];
  const heads: Array<{ block: number; timestamp: number }> = [];
  const snapshotProgress: Array<{
    bytesReceived: number;
    model: string;
    modelsReceived: number;
    rowsReceived: number;
  }> = [];
  const transactions: GameSyncTransaction[] = [];
  const handlers: GameSyncSubscriptionHandlers = {
    onEntity: (entity) => entities.push(entity),
    onEvent: (event) => events.push(event),
    onEventGapFill: () => undefined,
    onHead: (head) => heads.push(head),
    onSnapshotChunk: (progress) => snapshotProgress.push(progress),
    onTransaction: (transaction) => transactions.push(transaction),
  };
  const transport = new HeraldGameSyncTransport({
    reconnectMs: 200,
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    url: "wss://herald.test/madara/games/54",
  });
  return { entities, events, handlers, heads, snapshotProgress, sockets, transactions, transport };
};

const hello = (epoch: string, seq: number) => ({
  confirmed_block: 12,
  epoch,
  preconfirmed_block: 13,
  seq,
  type: "hello",
});

const snapshot = (epoch: string, seq: number, key: string, value: number) => [
  { epoch, model: "ExplorerTroops", rows: [{ key, value: { game_id: "0x36", value } }], seq, type: "snapshot" },
  { epoch, seq, type: "snapshot_end" },
];

const diff = (epoch: string, seq: number, key: string, value: number, preconfirmed: boolean) => ({
  block: preconfirmed ? null : 13,
  del: [],
  epoch,
  preconfirmed,
  seq,
  set: [{ key, model: "ExplorerTroops", value: { game_id: "0x36", value } }],
  type: "diff",
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HeraldGameSyncTransport", () => {
  it("hydrates a snapshot and keeps a pre-confirmed row through an overlay reset", async () => {
    const harness = streamHarness();
    const subscribed = harness.transport.subscribe(harness.handlers);
    const socket = harness.sockets[0]!;
    socket.receive(hello("epoch-a", 0));
    await subscribed;
    expect(socket.sent).toEqual([{ epoch: "", seq: 0, type: "resume" }]);

    const snapshotPage = harness.transport.fetchSnapshotPage();
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    await expect(snapshotPage).resolves.toMatchObject({
      items: [{ hashed_keys: "0x1", models: { ExplorerTroops: { game_id: "0x36", value: 1 } } }],
    });
    expect(harness.snapshotProgress).toEqual([
      expect.objectContaining({ model: "ExplorerTroops", modelsReceived: 1, rowsReceived: 1 }),
    ]);
    expect(harness.snapshotProgress[0]?.bytesReceived).toBeGreaterThan(0);

    socket.receive(diff("epoch-a", 1, "0x1", 2, true));
    socket.receive({ confirmed_block: 12, epoch: "epoch-a", seq: 2, type: "overlay_reset" });
    socket.receive(diff("epoch-a", 3, "0x1", 2, false));
    socket.receive(diff("epoch-a", 4, "0x1", 1, true));

    // The reset carries no rows and the confirmed diff repeats the pending value: neither reaches RECS.
    expect(harness.entities).toEqual([
      { hashed_keys: "0x1", models: { ExplorerTroops: { game_id: "0x36", value: 2 } } },
      { hashed_keys: "0x1", models: { ExplorerTroops: { game_id: "0x36", value: 1 } } },
    ]);
  });

  it("streams the first snapshot to the runtime one model page at a time, before snapshot_end", async () => {
    const harness = streamHarness();
    const subscribed = harness.transport.subscribe(harness.handlers);
    const socket = harness.sockets[0]!;
    socket.receive(hello("epoch-a", 0));
    await subscribed;

    socket.receive({
      epoch: "epoch-a",
      model: "Structure",
      rows: [{ key: "0x1", value: { game_id: "0x36" } }],
      seq: 0,
      type: "snapshot",
    });
    const first = await harness.transport.fetchSnapshotPage();
    expect(first.items).toEqual([{ hashed_keys: "0x1", models: { Structure: { game_id: "0x36" } } }]);
    expect(first.nextCursor).toBeDefined();

    const pending = harness.transport.fetchSnapshotPage();
    socket.receive({
      epoch: "epoch-a",
      model: "Tile",
      rows: [{ key: "0x2", value: { game_id: "0x36" } }],
      seq: 0,
      type: "snapshot",
    });
    const second = await pending;
    expect(second.items).toEqual([{ hashed_keys: "0x2", models: { Tile: { game_id: "0x36" } } }]);
    expect(second.nextCursor).toBeDefined();

    const last = harness.transport.fetchSnapshotPage();
    socket.receive({ epoch: "epoch-a", seq: 0, type: "snapshot_end" });
    expect(await last).toEqual({ items: [] });
  });

  it("delivers a reconciled snapshot as one batch of changed rows only", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const batches: unknown[] = [];
    harness.handlers.onEntityBatch = (batch) => batches.push(batch);
    const subscribed = harness.transport.subscribe(harness.handlers);
    const first = harness.sockets[0]!;
    first.receive(hello("epoch-a", 0));
    await subscribed;
    first.receive({
      epoch: "epoch-a",
      model: "ExplorerTroops",
      rows: [
        { key: "0x1", value: { game_id: "0x36", value: 1 } },
        { key: "0x2", value: { game_id: "0x36", value: 2 } },
      ],
      seq: 0,
      type: "snapshot",
    });
    first.receive({ epoch: "epoch-a", seq: 0, type: "snapshot_end" });
    await harness.transport.fetchSnapshotPage();

    first.close();
    await vi.advanceTimersByTimeAsync(200);
    const restarted = harness.sockets[1]!;
    restarted.receive(hello("epoch-b", 0));
    restarted.receive({
      epoch: "epoch-b",
      model: "ExplorerTroops",
      rows: [
        { key: "0x1", value: { game_id: "0x36", value: 1 } },
        { key: "0x3", value: { game_id: "0x36", value: 3 } },
      ],
      seq: 0,
      type: "snapshot",
    });
    restarted.receive({ epoch: "epoch-b", seq: 0, type: "snapshot_end" });

    expect(batches).toEqual([
      {
        entities: [
          { hashed_keys: "0x2", models: { ExplorerTroops: {} } },
          { hashed_keys: "0x3", models: { ExplorerTroops: { game_id: "0x36", value: 3 } } },
        ],
        preconfirmed: false,
      },
    ]);
    expect(harness.entities).toEqual([]);
  });

  it("applies snapshot-boundary overlay transactions before the live sequence", async () => {
    const harness = streamHarness();
    const subscribed = harness.transport.subscribe(harness.handlers);
    const socket = harness.sockets[0]!;
    socket.receive(hello("epoch-a", 0));
    await subscribed;

    const snapshotPage = harness.transport.fetchSnapshotPage();
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    socket.receive(diff("epoch-a", 0, "0x1", 2, true));
    socket.receive(diff("epoch-a", 0, "0x2", 3, true));
    socket.receive({ confirmed_block: 12, epoch: "epoch-a", seq: 1, type: "overlay_reset" });

    await expect(snapshotPage).resolves.toMatchObject({
      items: [{ hashed_keys: "0x1", models: { ExplorerTroops: { game_id: "0x36", value: 1 } } }],
    });
    expect(harness.entities).toEqual([
      { hashed_keys: "0x1", models: { ExplorerTroops: { game_id: "0x36", value: 2 } } },
      { hashed_keys: "0x2", models: { ExplorerTroops: { game_id: "0x36", value: 3 } } },
    ]);
  });

  it("routes event effects, transaction status, and heads on their own channels", async () => {
    const harness = streamHarness();
    const subscribed = harness.transport.subscribe(harness.handlers);
    const socket = harness.sockets[0]!;
    socket.receive(hello("epoch-a", 0));
    await subscribed;
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    await harness.transport.fetchSnapshotPage();

    socket.receive({
      block: null,
      del: [],
      epoch: "epoch-a",
      preconfirmed: true,
      seq: 1,
      set: [{ key: "0xbeef", model: "BattleEvent", value: { game_id: "0x36", timestamp: "0x7" } }],
      type: "diff",
    });
    socket.receive({
      block: null,
      epoch: "epoch-a",
      hash: "0xabc",
      seq: 2,
      status: "PRE_CONFIRMED",
      type: "tx",
    });
    socket.receive({ block: 13, epoch: "epoch-a", seq: 3, timestamp: 100, type: "head" });

    expect(harness.events).toEqual([
      { hashed_keys: "0xbeef", models: { BattleEvent: { game_id: "0x36", timestamp: "0x7" } } },
    ]);
    expect(harness.transactions).toEqual([{ block: null, hash: "0xabc", status: "PRE_CONFIRMED" }]);
    expect(harness.heads).toEqual([{ block: 13, timestamp: 100 }]);
  });

  it("preserves the pre-confirmed transaction boundary for atomic ingest", async () => {
    const harness = streamHarness();
    const batches: unknown[] = [];
    harness.handlers.onEntityBatch = (batch) => batches.push(batch);
    const subscribed = harness.transport.subscribe(harness.handlers);
    const socket = harness.sockets[0]!;
    socket.receive(hello("epoch-a", 0));
    await subscribed;
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    await harness.transport.fetchSnapshotPage();

    socket.receive({
      block: null,
      del: [{ key: "0x3", model: "ExplorerTroops" }],
      epoch: "epoch-a",
      preconfirmed: true,
      seq: 1,
      set: [
        { key: "0x1", model: "ExplorerTroops", value: { x: 2 } },
        { key: "0x2", model: "TileOpt", value: { biome: 3 } },
      ],
      transaction_hash: "0xabc",
      type: "diff",
    });

    expect(batches).toEqual([
      {
        entities: [
          { hashed_keys: "0x1", models: { ExplorerTroops: { x: 2 } } },
          { hashed_keys: "0x2", models: { TileOpt: { biome: 3 } } },
          { hashed_keys: "0x3", models: { ExplorerTroops: {} } },
        ],
        preconfirmed: true,
        transactionHash: "0xabc",
      },
    ]);
    expect(harness.entities).toEqual([]);
  });

  it("resumes by sequence and reconciles a snapshot after an epoch change", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const subscribed = harness.transport.subscribe(harness.handlers);
    const first = harness.sockets[0]!;
    first.receive(hello("epoch-a", 5));
    await subscribed;
    snapshot("epoch-a", 5, "0x1", 1).forEach((message) => first.receive(message));
    await harness.transport.fetchSnapshotPage();

    first.close();
    await vi.advanceTimersByTimeAsync(200);
    const resumed = harness.sockets[1]!;
    resumed.receive(hello("epoch-a", 7));
    expect(resumed.sent).toEqual([{ epoch: "epoch-a", seq: 5, type: "resume" }]);
    resumed.receive({ block: 13, epoch: "epoch-a", seq: 6, timestamp: 100, type: "head" });
    resumed.receive(diff("epoch-a", 7, "0x1", 2, false));

    resumed.close();
    await vi.advanceTimersByTimeAsync(200);
    const restarted = harness.sockets[2]!;
    restarted.receive(hello("epoch-b", 0));
    expect(restarted.sent).toEqual([{ epoch: "epoch-a", seq: 7, type: "resume" }]);
    snapshot("epoch-b", 0, "0x2", 9).forEach((message) => restarted.receive(message));

    expect(harness.entities.slice(-2)).toEqual([
      { hashed_keys: "0x1", models: { ExplorerTroops: {} } },
      { hashed_keys: "0x2", models: { ExplorerTroops: { game_id: "0x36", value: 9 } } },
    ]);
  });

  it("requests a fresh snapshot after detecting a sequence gap", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const subscribed = harness.transport.subscribe(harness.handlers);
    const first = harness.sockets[0]!;
    first.receive(hello("epoch-a", 0));
    await subscribed;
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => first.receive(message));
    await harness.transport.fetchSnapshotPage();

    first.receive({ block: 13, epoch: "epoch-a", seq: 2, timestamp: 100, type: "head" });
    expect(first.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    const replacement = harness.sockets[1]!;
    replacement.receive(hello("epoch-a", 2));

    expect(replacement.sent).toEqual([{ epoch: "", seq: 0, type: "resume" }]);
  });
});
