import type { NativeWorldBindings } from "@bibliothecadao/types";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json";
import { nativeModelDefinition } from "../client/native-models";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeraldGameSyncTransport, type HeraldSocket } from "./herald-game-sync-transport";
import type {
  GameSyncEvent,
  GameSyncFact,
  GameSyncFactBatch,
  GameSyncSnapshotChunkProgress,
  GameSyncSubscriptionHandlers,
  GameSyncTransaction,
} from "./game-sync-types";

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

type Delivery =
  | { kind: "snapshot-start" }
  | { kind: "snapshot-model"; model: string; facts: GameSyncFact[] }
  | { kind: "snapshot-end" }
  | { kind: "scope"; facts: GameSyncFact[]; expedition: boolean }
  | ({ kind: "facts" } & GameSyncFactBatch);

const streamHarness = () => {
  const sockets: FakeSocket[] = [];
  const urls: string[] = [];
  const deliveries: Delivery[] = [];
  const events: GameSyncEvent[] = [];
  const heads: Array<{ block: number; timestamp: number }> = [];
  const snapshotProgress: GameSyncSnapshotChunkProgress[] = [];
  const transactions: GameSyncTransaction[] = [];
  const startFailures: Error[] = [];
  const handlers: GameSyncSubscriptionHandlers = {
    onSnapshotStart: () => deliveries.push({ kind: "snapshot-start" }),
    onSnapshotModel: (model, facts, progress) => {
      deliveries.push({ kind: "snapshot-model", model, facts });
      snapshotProgress.push(progress);
    },
    onSnapshotEnd: () => deliveries.push({ kind: "snapshot-end" }),
    onScope: (facts, expedition) => deliveries.push({ kind: "scope", facts, expedition }),
    onFacts: (batch) => deliveries.push({ kind: "facts", ...batch }),
    onEvent: (event) => events.push(event),
    onHead: (head) => heads.push(head),
    onTransaction: (transaction) => transactions.push(transaction),
    onStartFailure: (error) => startFailures.push(error),
  };
  const transport = new HeraldGameSyncTransport({
    modelDefinition: nativeModelDefinition(bindings as unknown as NativeWorldBindings),
    reconnectMs: 200,
    socketFactory: (url) => {
      urls.push(url);
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    url: "wss://herald.test/games/54",
  });
  const factBatches = () => deliveries.filter((delivery) => delivery.kind === "facts");
  return {
    deliveries,
    events,
    factBatches,
    handlers,
    heads,
    snapshotProgress,
    sockets,
    startFailures,
    transactions,
    transport,
    urls,
  };
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

const troops = (key: string, value: number): GameSyncFact => ({
  model: "ExplorerTroops",
  key,
  value: { game_id: "0x36", value },
});

const attached = async (harness: ReturnType<typeof streamHarness>, epoch = "epoch-a", seq = 0) => {
  const subscribed = harness.transport.subscribe(harness.handlers);
  const socket = harness.sockets.at(-1)!;
  socket.receive(hello(epoch, seq));
  const writer = await subscribed;
  return { socket, writer };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("HeraldGameSyncTransport", () => {
  it("forwards an actor's scope replacement and resumes that actor after reconnect", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const { socket, writer } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    harness.transport.selectActor("0x000111");
    expect(socket.sent.at(-1)).toEqual({ type: "select_actor", actor: "0x111" });
    expect(socket.closed).toBe(false);
    socket.receive({
      type: "scope",
      epoch: "epoch-a:273",
      seq: 5,
      actor: "0x111",
      expedition: true,
      set: [{ model: "ActionNonce", key: "0x2", value: { actor: "0x111", next_nonce: "4" } }],
    });
    expect(harness.deliveries.at(-1)).toEqual({
      kind: "scope",
      facts: [{ model: "ActionNonce", key: "0x2", value: { actor: "0x111", next_nonce: "4" } }],
      expedition: true,
    });
    harness.transport.selectActor("0x222");
    socket.receive({ type: "scope", epoch: "epoch-a:546", seq: 1, actor: "0x222", expedition: false, set: [] });
    socket.close();
    await vi.advanceTimersByTimeAsync(200);
    expect(new URL(harness.urls[1]).searchParams.get("actor")).toBe("0x222");
    harness.sockets[1].receive(hello("epoch-a:546", 2));
    expect(harness.sockets[1].sent.at(-1)).toEqual({ type: "resume", epoch: "epoch-a:546", seq: 1 });
    writer.cancel();
  });

  it("preserves each story event's provisional or confirmed block metadata", async () => {
    const harness = streamHarness();
    harness.handlers.onEvent = vi.fn();
    const { socket, writer } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    const set = [{ key: "0xstory", model: "StoryEvent", value: { timestamp: 100 } }];
    socket.receive({ ...diff("epoch-a", 1, "0x1", 1, true), set });
    socket.receive({ ...diff("epoch-a", 2, "0x1", 1, false), set });
    expect(harness.handlers.onEvent).toHaveBeenNthCalledWith(1, expect.anything(), {
      block: null,
      preconfirmed: true,
      confirmedAfterAttach: false,
    });
    expect(harness.handlers.onEvent).toHaveBeenNthCalledWith(2, expect.anything(), {
      block: 13,
      preconfirmed: false,
      confirmedAfterAttach: true,
    });
    socket.receive({ ...diff("epoch-a", 3, "0x1", 1, false), block: 12, set });
    expect(harness.handlers.onEvent).toHaveBeenLastCalledWith(expect.anything(), {
      block: 12,
      preconfirmed: false,
      confirmedAfterAttach: false,
    });
    writer.cancel();
  });

  it("delivers nothing from a rejected diff and recovers through a fresh snapshot", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const harness = streamHarness();
    const { socket, writer } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    const update = diff("epoch-a", 1, "0x1", 2, true);
    socket.receive({ ...update, set: [...update.set, { key: "0xbad", model: "UnknownModel", value: {} }] });
    expect(harness.factBatches()).toHaveLength(0);
    expect(socket.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    const recovered = harness.sockets[1]!;
    recovered.receive(hello("epoch-a", 1));
    expect(recovered.sent.at(-1)).toEqual({ type: "resume", epoch: "", seq: 0 });
    snapshot("epoch-a", 1, "0x1", 2).forEach((message) => recovered.receive(message));
    expect(harness.deliveries.slice(-3)).toEqual([
      { kind: "snapshot-start" },
      { kind: "snapshot-model", model: "ExplorerTroops", facts: [troops("0x1", 2)] },
      { kind: "snapshot-end" },
    ]);
    expect(error).toHaveBeenCalledOnce();
    writer.cancel();
    error.mockRestore();
  });

  it("delivers the whole fact batch and transaction status when an ephemeral callback fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const harness = streamHarness();
    harness.handlers.onEvent = () => {
      throw new Error("presentation failed");
    };
    const { socket, writer } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    const update = diff("epoch-a", 1, "0x1", 2, true);
    socket.receive({ ...update, set: [...update.set, { key: "0xstory", model: "StoryEvent", value: {} }] });
    socket.receive({ type: "tx", epoch: "epoch-a", seq: 2, hash: "0x123", block: null, status: "PRE_CONFIRMED" });
    expect(harness.factBatches()).toHaveLength(1);
    expect(harness.transactions).toHaveLength(1);
    expect(socket.closed).toBe(false);
    expect(error).toHaveBeenCalledOnce();
    writer.cancel();
    error.mockRestore();
  });

  it("retries a stalled handshake without waiting for the browser's close event", async () => {
    vi.useFakeTimers();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const harness = streamHarness();
    const subscribed = harness.transport.subscribe(harness.handlers);
    const stalled = harness.sockets[0]!;
    const staleMessage = stalled.onmessage!;
    vi.spyOn(stalled, "close").mockImplementation(() => {});

    await vi.advanceTimersByTimeAsync(10_200);
    expect(stalled.close).toHaveBeenCalledOnce();
    expect(harness.sockets).toHaveLength(2);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("No hello within 10000ms"));
    staleMessage({ data: JSON.stringify(hello("stale", 0)) });
    expect(harness.sockets[1]!.sent).toEqual([]);
    harness.sockets[1]!.receive(hello("current", 0));
    const writer = await subscribed;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(harness.sockets).toHaveLength(2);
    writer.cancel();
    warning.mockRestore();
  });

  it("cancels the reconnect handshake when its subscription is stopped", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const { socket, writer } = await attached(harness, "current");
    socket.close();
    await vi.advanceTimersByTimeAsync(200);
    expect(harness.sockets).toHaveLength(2);
    writer.cancel();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(harness.sockets).toHaveLength(2);
    expect(harness.sockets[1]!.closed).toBe(true);
  });

  it("streams the snapshot model by model and forwards every diff through an overlay reset", async () => {
    const harness = streamHarness();
    const { socket } = await attached(harness);
    expect(socket.sent).toEqual([{ epoch: "", seq: 0, type: "resume" }]);

    socket.receive({
      epoch: "epoch-a",
      model: "Structure",
      rows: [{ key: "0x9", value: { game_id: "0x36" } }],
      seq: 0,
      type: "snapshot",
    });
    expect(harness.deliveries).toEqual([
      { kind: "snapshot-start" },
      {
        kind: "snapshot-model",
        model: "Structure",
        facts: [{ model: "Structure", key: "0x9", value: { game_id: "0x36" } }],
      },
    ]);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    expect(harness.snapshotProgress.at(-1)).toMatchObject({
      model: "ExplorerTroops",
      modelsReceived: 2,
      rowsReceived: 2,
    });
    expect(harness.snapshotProgress[0]?.bytesReceived).toBeGreaterThan(0);

    socket.receive(diff("epoch-a", 1, "0x1", 2, true));
    socket.receive({ confirmed_block: 12, epoch: "epoch-a", seq: 2, type: "overlay_reset" });
    socket.receive(diff("epoch-a", 3, "0x1", 2, false));
    socket.receive(diff("epoch-a", 4, "0x1", 1, true));

    // The reset carries no rows; the native store drops the confirmed repeat of the pending value.
    expect(harness.factBatches().map((batch) => batch.facts)).toEqual([
      [troops("0x1", 2)],
      [troops("0x1", 2)],
      [troops("0x1", 1)],
    ]);
  });

  it("applies snapshot-boundary overlay transactions before the live sequence", async () => {
    const harness = streamHarness();
    const { socket } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    socket.receive(diff("epoch-a", 0, "0x1", 2, true));
    socket.receive(diff("epoch-a", 0, "0x2", 3, true));
    socket.receive({ confirmed_block: 12, epoch: "epoch-a", seq: 1, type: "overlay_reset" });

    expect(harness.factBatches().map((batch) => batch.facts)).toEqual([[troops("0x1", 2)], [troops("0x2", 3)]]);
    expect(socket.closed).toBe(false);
  });

  it("routes event effects, transaction status, and heads on their own channels", async () => {
    const harness = streamHarness();
    const { socket } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));

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
      executions: [
        {
          gameId: "54",
          actor: "291",
          nonce: "3",
          order: "8",
          nonceConsumed: true,
          status: "SUCCEEDED",
          reason: "",
          batchRemaining: "9",
        },
      ],
    });
    socket.receive({ block: 13, epoch: "epoch-a", seq: 3, timestamp: 100, type: "head" });

    expect(harness.events).toEqual([
      { model: "BattleEvent", key: "0xbeef", value: { game_id: "0x36", timestamp: "0x7" } },
    ]);
    expect(harness.factBatches()).toEqual([]);
    expect(harness.transactions).toEqual([
      {
        block: null,
        hash: "0xabc",
        status: "PRE_CONFIRMED",
        executions: [
          {
            gameId: "54",
            actor: "291",
            nonce: "3",
            order: "8",
            nonceConsumed: true,
            status: "SUCCEEDED",
            reason: "",
            batchRemaining: "9",
          },
        ],
      },
    ]);
    expect(harness.heads).toEqual([{ block: 13, preconfirmed: false, timestamp: 100 }]);
  });

  it("delivers one Herald diff as one fact batch with its transaction boundary", async () => {
    const harness = streamHarness();
    const { socket } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));

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

    expect(harness.factBatches()).toEqual([
      {
        kind: "facts",
        facts: [
          { model: "ExplorerTroops", key: "0x1", value: { x: 2 } },
          { model: "TileOpt", key: "0x2", value: { biome: 3 } },
          { model: "ExplorerTroops", key: "0x3", value: null },
        ],
        preconfirmed: true,
        transactionHash: "0xabc",
      },
    ]);
  });

  it("resumes by sequence and takes a fresh snapshot after an epoch change", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const { socket: first } = await attached(harness, "epoch-a", 5);
    snapshot("epoch-a", 5, "0x1", 1).forEach((message) => first.receive(message));

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

    expect(harness.deliveries.slice(-3)).toEqual([
      { kind: "snapshot-start" },
      { kind: "snapshot-model", model: "ExplorerTroops", facts: [troops("0x2", 9)] },
      { kind: "snapshot-end" },
    ]);
  });

  it("asks for a fresh snapshot when a reconnect cuts one short", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const { socket: first } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => first.receive(message));
    first.close();
    await vi.advanceTimersByTimeAsync(200);
    const second = harness.sockets[1]!;
    second.receive(hello("epoch-b", 0));
    second.receive(snapshot("epoch-b", 0, "0x1", 2)[0]);
    second.close();
    await vi.advanceTimersByTimeAsync(200);
    harness.sockets[2]!.receive(hello("epoch-b", 0));

    expect(harness.sockets[2]!.sent).toEqual([{ epoch: "", seq: 0, type: "resume" }]);
  });

  it("requests a fresh snapshot after detecting a sequence gap", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const { socket: first } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => first.receive(message));

    first.receive({ block: 13, epoch: "epoch-a", seq: 2, timestamp: 100, type: "head" });
    expect(first.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    const replacement = harness.sockets[1]!;
    replacement.receive(hello("epoch-a", 2));

    expect(replacement.sent).toEqual([{ epoch: "", seq: 0, type: "resume" }]);
  });

  it("fails the session start when the stream breaks before its first snapshot ends", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const harness = streamHarness();
    const { socket, writer } = await attached(harness);
    socket.receive({ type: "snapshot", epoch: "epoch-a", seq: 0 });
    expect(harness.startFailures).toHaveLength(1);
    writer.cancel();
    error.mockRestore();
  });
});
