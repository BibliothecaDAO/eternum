import type { NativeWorldBindings } from "@bibliothecadao/types";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json";
import { nativeModelDefinition } from "../client/native-models";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GameFinalizedError,
  HeraldGameSyncTransport,
  type HeraldGameSyncTransportOptions,
  type HeraldSocket,
} from "./herald-game-sync-transport";
import { HERALD_GAME_FINALIZED_CLOSE, HeraldHttpError, type HeraldGameSnapshot } from "./herald-http-types";
import type {
  GameSyncEvent,
  GameSyncFact,
  GameSyncFactBatch,
  GameSyncSnapshotChunkProgress,
  GameSyncSnapshotState,
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

const streamHarness = (options: Partial<HeraldGameSyncTransportOptions> = {}) => {
  const sockets: FakeSocket[] = [];
  const urls: string[] = [];
  const deliveries: Delivery[] = [];
  const events: GameSyncEvent[] = [];
  const heads: Array<{ block: number; timestamp: number }> = [];
  const snapshotProgress: GameSyncSnapshotChunkProgress[] = [];
  const transactions: GameSyncTransaction[] = [];
  const startFailures: Error[] = [];
  const reachability: boolean[] = [];
  const handlers: GameSyncSubscriptionHandlers = {
    onSnapshotStart: () => deliveries.push({ kind: "snapshot-start" }),
    onSnapshotModel: (model, facts, progress) => {
      deliveries.push({ kind: "snapshot-model", model, facts });
      snapshotProgress.push(progress);
    },
    onSnapshotEnd: () => {
      deliveries.push({ kind: "snapshot-end" });
      return true;
    },
    onScope: (facts, expedition) => {
      deliveries.push({ kind: "scope", facts, expedition });
      return true;
    },
    onFacts: (batch) => deliveries.push({ kind: "facts", ...batch }),
    onEvent: (event) => events.push(event),
    onHead: (head) => heads.push(head),
    onTransaction: (transaction) => transactions.push(transaction),
    onStartFailure: (error) => startFailures.push(error),
  };
  const transport = new HeraldGameSyncTransport({
    gameId: 1,
    modelDefinition: nativeModelDefinition(bindings as unknown as NativeWorldBindings),
    onConnection: (reachable) => reachability.push(reachable),
    reconnectMs: 200,
    socketFactory: (url) => {
      urls.push(url);
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    url: "wss://herald.test/games/54",
    ...options,
  });
  const factBatches = () => deliveries.filter((delivery) => delivery.kind === "facts");
  return {
    deliveries,
    events,
    factBatches,
    handlers,
    heads,
    reachability,
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
  it("ends a finalized game's start with GameFinalizedError, and does not reconnect", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const subscribed = harness.transport.subscribe(harness.handlers);
    const socket = harness.sockets.at(-1)!;
    const finalizedClose = socket.onclose as unknown as (event: { code: number }) => void;
    finalizedClose({ code: HERALD_GAME_FINALIZED_CLOSE });
    await expect(subscribed).rejects.toBeInstanceOf(GameFinalizedError);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(harness.sockets).toHaveLength(1);
  });

  it("reopens the store on a finalized game's final state, whole, when the stream ends while the game is shown", async () => {
    const harness = streamHarness();
    const gates: GameSyncSnapshotState[] = [];
    harness.handlers.onSnapshotState = (state) => void gates.push(state);
    const reads: number[] = [];
    (harness.transport as unknown as { options: { finalState: () => Promise<unknown> } }).options.finalState =
      async () => {
        reads.push(1);
        return {
          confirmed_block: 40,
          game_id: "0x36",
          models: [{ model: "ExplorerTroops", rows: [{ key: "0x9", value: { game_id: "0x36", value: 7 } }] }],
        };
      };
    const { socket } = await attached(harness);
    snapshot("epoch-a", 1, "0x1", 1).forEach((message) => socket.receive(message));
    // Herald ends the stream mid-way through a fresh snapshot, then closes it for good: the gate is shut.
    socket.receive({ epoch: "epoch-a", model: "ExplorerTroops", rows: [], seq: 2, type: "snapshot" });
    expect(gates.at(-1)).toMatchObject({ complete: false });
    harness.deliveries.length = 0;
    (socket.onclose as unknown as (event: { code: number }) => void)({ code: HERALD_GAME_FINALIZED_CLOSE });
    await vi.waitFor(() => expect(gates.at(-1)).toMatchObject({ complete: true, actor: null }));
    // The close shut the gate first; the final state opened it, at the stream's last chain time.
    expect(gates.slice(-2).map(({ complete }) => complete)).toEqual([false, true]);
    expect(reads).toEqual([1]);
    expect(harness.deliveries).toEqual([
      { kind: "snapshot-start" },
      { kind: "snapshot-model", model: "ExplorerTroops", facts: [troops("0x9", 7)] },
      { kind: "snapshot-end" },
    ]);
    expect(harness.sockets).toHaveLength(1);
  });

  it("retries a finalized game's final state until it answers, its gate shut meanwhile", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const gates: GameSyncSnapshotState[] = [];
    harness.handlers.onSnapshotState = (state) => void gates.push(state);
    let reads = 0;
    (harness.transport as unknown as { options: { finalState: () => Promise<unknown> } }).options.finalState =
      async () => {
        reads += 1;
        if (reads < 3) throw new Error("review unavailable");
        return {
          confirmed_block: 40,
          game_id: "0x36",
          models: [{ model: "ExplorerTroops", rows: [{ key: "0x9", value: { game_id: "0x36", value: 7 } }] }],
        };
      };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { socket } = await attached(harness);
    snapshot("epoch-a", 1, "0x1", 1).forEach((message) => socket.receive(message));
    harness.deliveries.length = 0;
    (socket.onclose as unknown as (event: { code: number }) => void)({ code: HERALD_GAME_FINALIZED_CLOSE });
    await vi.advanceTimersByTimeAsync(0);
    // Until the final state answers, nothing reads as known that the store cannot vouch for.
    expect([reads, gates.at(-1)?.complete]).toEqual([1, false]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect([reads, gates.at(-1)?.complete]).toEqual([2, false]);
    await vi.advanceTimersByTimeAsync(2_000);
    expect([reads, gates.at(-1)?.complete]).toEqual([3, true]);
    expect(harness.deliveries).toEqual([
      { kind: "snapshot-start" },
      { kind: "snapshot-model", model: "ExplorerTroops", facts: [troops("0x9", 7)] },
      { kind: "snapshot-end" },
    ]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reads).toBe(3);
    expect(harness.sockets).toHaveLength(1);
    warn.mockRestore();
  });

  it("stops retrying a final state once its session is cancelled", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const finalState = vi.fn(async () => Promise.reject(new Error("review unavailable")));
    (harness.transport as unknown as { options: { finalState: () => Promise<unknown> } }).options.finalState =
      finalState;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { socket, writer } = await attached(harness);
    snapshot("epoch-a", 1, "0x1", 1).forEach((message) => socket.receive(message));
    (socket.onclose as unknown as (event: { code: number }) => void)({ code: HERALD_GAME_FINALIZED_CLOSE });
    await vi.advanceTimersByTimeAsync(3_000);
    const readsBeforeCancel = finalState.mock.calls.length;
    expect(readsBeforeCancel).toBeGreaterThan(1);
    writer.cancel();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(finalState).toHaveBeenCalledTimes(readsBeforeCancel);
    warn.mockRestore();
  });

  describe("a finalized game, watched", () => {
    /** Game 54's review snapshot: its registry, ended at 1,792,400,000, and one realm. */
    const REVIEW: HeraldGameSnapshot = {
      confirmed_block: 640,
      game_id: "54",
      models: [
        { model: "GameRegistry", rows: [{ key: "0x36", value: { game_id: "0x36", end_at: "0x6ad5da80" } }] },
        { model: "Structure", rows: [{ key: "0x36:0x7", value: { entity_id: "0x7" } }] },
      ],
    };
    const closeAsFinalized = (socket: FakeSocket) =>
      (socket.onclose as unknown as (event: { code: number }) => void)({ code: HERALD_GAME_FINALIZED_CLOSE });

    it("holds the game as it ended: its review snapshot, under the game's end as its one head, and nothing after", async () => {
      vi.useFakeTimers();
      const harness = streamHarness({ finalState: async () => REVIEW });
      const gates: GameSyncSnapshotState[] = [];
      harness.handlers.onSnapshotState = (state) => void gates.push(state);
      const subscribed = harness.transport.subscribe(harness.handlers);
      closeAsFinalized(harness.sockets.at(-1)!);
      await subscribed;
      await vi.advanceTimersByTimeAsync(1_000);
      expect(harness.heads).toEqual([{ block: 640, preconfirmed: false, timestamp: 1_792_400_000 }]);
      expect(harness.deliveries.map((delivery) => ("model" in delivery ? delivery.model : delivery.kind))).toEqual([
        "snapshot-start",
        "GameRegistry",
        "Structure",
        "snapshot-end",
      ]);
      expect(gates.at(-1)).toEqual({ gameId: 1, complete: true, actor: null, timestamp: 1_792_400_000 });
      expect(harness.startFailures).toEqual([]);
      expect(harness.sockets).toHaveLength(1);
    });

    /** A spectator's start on the final state, its gate open. */
    const startedOnFinalState = async () => {
      const finalState = vi.fn(async () => REVIEW);
      const harness = streamHarness({ finalState });
      const gates: GameSyncSnapshotState[] = [];
      harness.handlers.onSnapshotState = (state) => void gates.push(state);
      const subscribed = harness.transport.subscribe(harness.handlers);
      closeAsFinalized(harness.sockets.at(-1)!);
      const writer = await subscribed;
      await vi.waitFor(() => expect(gates.at(-1)?.complete).toBe(true));
      return { finalState, gates, harness, writer };
    };

    it.each([
      { label: "an account connecting", actor: "0x123", visit: undefined, after: { actor: "0x123" } },
      {
        label: "a realm visited (Frontier watches the leader)",
        actor: undefined,
        visit: "0x222",
        after: { actor: null, visit: "0x222" },
      },
    ])("keeps the finished game whole through $label: no stream, no second read", async ({ actor, visit, after }) => {
      const { finalState, gates, harness } = await startedOnFinalState();
      harness.transport.selectActor(actor, visit);
      await Promise.resolve();
      expect(gates.at(-1)).toEqual({ gameId: 1, complete: true, timestamp: 1_792_400_000, ...after });
      // And back: the account leaves, the visit ends.
      harness.transport.selectActor(undefined);
      await Promise.resolve();
      expect(gates.at(-1)).toEqual({ gameId: 1, complete: true, actor: null, timestamp: 1_792_400_000 });
      expect(finalState).toHaveBeenCalledTimes(1);
      expect(harness.sockets).toHaveLength(1);
      expect(harness.sockets[0].sent.filter((message) => message.type === "select_actor")).toEqual([]);
    });

    it("opens the final state on the selection made while it was read", async () => {
      let answer!: (snapshot: HeraldGameSnapshot) => void;
      const harness = streamHarness({ finalState: () => new Promise((resolve) => (answer = resolve)) });
      const gates: GameSyncSnapshotState[] = [];
      harness.handlers.onSnapshotState = (state) => void gates.push(state);
      const subscribed = harness.transport.subscribe(harness.handlers);
      closeAsFinalized(harness.sockets.at(-1)!);
      harness.transport.selectActor("0x123");
      answer(REVIEW);
      await subscribed;
      await vi.waitFor(() => expect(gates.at(-1)?.complete).toBe(true));
      expect(gates.at(-1)).toEqual({ gameId: 1, complete: true, actor: "0x123", timestamp: 1_792_400_000 });
    });

    it("takes nothing from a final state read after its session was cancelled", async () => {
      let answer!: (snapshot: HeraldGameSnapshot) => void;
      const harness = streamHarness({ finalState: () => new Promise((resolve) => (answer = resolve)) });
      const { socket, writer } = await attached(harness);
      snapshot("epoch-a", 1, "0x1", 1).forEach((message) => socket.receive(message));
      harness.deliveries.length = 0;
      closeAsFinalized(socket);
      writer.cancel();
      answer(REVIEW);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(harness.deliveries).toEqual([]);
    });

    it("ends a player's live game whole on its final state, under the stream's last chain time", async () => {
      const harness = streamHarness({ finalState: async () => REVIEW, url: "wss://herald.test/games/54?actor=0x123" });
      const gates: GameSyncSnapshotState[] = [];
      harness.handlers.onSnapshotState = (state) => void gates.push(state);
      const { socket } = await attached(harness);
      snapshot("epoch-a", 1, "0x1", 1).forEach((message) => socket.receive(message));
      socket.receive({ type: "head", epoch: "epoch-a", seq: 2, block: 13, preconfirmed: false, timestamp: 350 });
      closeAsFinalized(socket);
      await vi.waitFor(() => expect(gates.at(-1)?.complete).toBe(true));
      expect(gates.at(-1)).toEqual({ gameId: 1, complete: true, actor: "0x123", timestamp: 350 });
      // The player leaves the account: the finished game stays whole.
      harness.transport.selectActor(undefined);
      await Promise.resolve();
      expect(gates.at(-1)).toEqual({ gameId: 1, complete: true, actor: null, timestamp: 350 });
    });

    it("never fails a replacement subscription with an earlier start's final-state failure", async () => {
      let failOld!: (reason: Error) => void;
      const harness = streamHarness({ finalState: () => new Promise((_resolve, reject) => (failOld = reject)) });
      const old = harness.transport.subscribe(harness.handlers).then(
        () => "ready",
        () => "cancelled",
      );
      closeAsFinalized(harness.sockets[0]!);
      const failures: Error[] = [];
      const replacement = harness.transport
        .subscribe({ ...harness.handlers, onStartFailure: (error) => failures.push(error) })
        .then(
          () => "ready",
          () => "rejected",
        );
      failOld(new Error("the old read failed"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      harness.sockets[1]!.receive(hello("epoch-b", 0));
      expect(await replacement).toBe("ready");
      expect(failures).toEqual([]);
      // The replaced start is settled too, as cancelled, not left waiting.
      expect(await old).toBe("cancelled");
      harness.transport.dispose();
    });

    it("settles a spectator's start cancelled while its final state is still being read", async () => {
      const harness = streamHarness({ finalState: () => new Promise<HeraldGameSnapshot>(() => {}) });
      const outcome = harness.transport.subscribe(harness.handlers).then(
        () => "ready",
        () => "cancelled",
      );
      closeAsFinalized(harness.sockets[0]!);
      harness.transport.dispose();
      expect(await outcome).toBe("cancelled");
      expect(harness.deliveries).toEqual([]);
    });

    it("still ends a player's start as finalized: a player's finished game leads to its results", async () => {
      const finalState = vi.fn(async () => REVIEW);
      const harness = streamHarness({ finalState, url: "wss://herald.test/games/54?actor=0x123" });
      const subscribed = harness.transport.subscribe(harness.handlers);
      closeAsFinalized(harness.sockets.at(-1)!);
      await expect(subscribed).rejects.toBeInstanceOf(GameFinalizedError);
      expect(finalState).not.toHaveBeenCalled();
    });

    it("ends the start as finalized when the review snapshot holds no end", async () => {
      const harness = streamHarness({ finalState: async () => ({ ...REVIEW, models: REVIEW.models.slice(1) }) });
      const subscribed = harness.transport.subscribe(harness.handlers);
      closeAsFinalized(harness.sockets.at(-1)!);
      await expect(subscribed).rejects.toBeInstanceOf(GameFinalizedError);
      expect(harness.deliveries).toEqual([]);
    });

    it("ends the start as finalized after one read when Herald refuses the review snapshot", async () => {
      vi.useFakeTimers();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      // Herald froze no review for this game, and never will: its answer does not change on a retry.
      const finalState = vi.fn(async (): Promise<HeraldGameSnapshot> => {
        throw new HeraldHttpError("Herald review snapshot failed: 404 Not Found", 404);
      });
      const harness = streamHarness({ finalState });
      const subscribed = harness.transport.subscribe(harness.handlers);
      closeAsFinalized(harness.sockets.at(-1)!);
      await expect(subscribed).rejects.toBeInstanceOf(GameFinalizedError);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(finalState).toHaveBeenCalledTimes(1);
      expect(harness.deliveries).toEqual([]);
      warn.mockRestore();
    });

    it("starts on the final state once a review snapshot that did not answer does", async () => {
      vi.useFakeTimers();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const finalState = vi
        .fn<() => Promise<HeraldGameSnapshot>>()
        .mockRejectedValueOnce(new HeraldHttpError("Herald review snapshot failed: 503 Service Unavailable", 503))
        .mockResolvedValue(REVIEW);
      const harness = streamHarness({ finalState });
      const subscribed = harness.transport.subscribe(harness.handlers);
      closeAsFinalized(harness.sockets.at(-1)!);
      await vi.advanceTimersByTimeAsync(1_000);
      await subscribed;
      expect(finalState).toHaveBeenCalledTimes(2);
      expect(harness.heads).toEqual([{ block: 640, preconfirmed: false, timestamp: 1_792_400_000 }]);
      expect(harness.startFailures).toEqual([]);
      warn.mockRestore();
    });
  });

  it("uses streamed head time for absence scope and forgets it on disposal", async () => {
    const harness = streamHarness();
    const gates: GameSyncSnapshotState[] = [];
    harness.handlers.onSnapshotState = (state) => void gates.push(state);
    const { socket, writer } = await attached(harness);
    socket.receive({ epoch: "epoch-a", seq: 0, type: "snapshot_end" });
    expect(harness.transport.completedTimestamp()).toBeUndefined();
    socket.receive({ type: "head", epoch: "epoch-a", seq: 1, block: 13, preconfirmed: true, timestamp: 350 });
    expect(harness.transport.completedTimestamp()).toBe(350);
    socket.receive({ type: "head", epoch: "epoch-a", seq: 2, block: 12, preconfirmed: false, timestamp: 340 });
    expect(harness.transport.completedTimestamp()).toBe(350);
    // A diff leaves the store's gate as it is: a player's own action never turns every absent row unknown.
    const gatesBeforeDiff = gates.length;
    socket.receive(diff("epoch-a", 3, "0x1", 2, true));
    expect(gates).toHaveLength(gatesBeforeDiff);
    expect(gates.at(-1)).toMatchObject({ complete: true, timestamp: 350 });
    expect(harness.transport.completedTimestamp()).toBe(350);
    socket.receive({ type: "head", epoch: "epoch-a", seq: 4, block: 12, preconfirmed: false, timestamp: 340 });
    expect(harness.transport.completedTimestamp()).toBe(350);
    snapshot("epoch-b", 0, "0x1", 2).forEach((message) => socket.receive(message));
    expect(harness.transport.completedTimestamp()).toBeUndefined();
    socket.receive({ type: "head", epoch: "epoch-b", seq: 1, block: 1, preconfirmed: true, timestamp: 100 });
    expect(harness.transport.completedTimestamp()).toBe(100);
    writer.cancel();
    expect(harness.transport.completedActor()).toBeUndefined();
    expect(harness.transport.completedTimestamp()).toBeUndefined();
  });

  it("knows the chain time from Herald's hello, before the first snapshot row", async () => {
    const harness = streamHarness();
    const subscribed = harness.transport.subscribe(harness.handlers);
    harness.sockets.at(-1)!.receive({ ...hello("epoch-a", 0), confirmed_timestamp: 1_790_194_601 });
    await subscribed;
    expect(harness.heads).toEqual([{ block: 12, preconfirmed: false, timestamp: 1_790_194_601 }]);

    // A Herald before its first confirmed head names no time; the clock then waits for the stream's head.
    const early = streamHarness();
    const earlySubscribed = early.transport.subscribe(early.handlers);
    early.sockets.at(-1)!.receive({ ...hello("epoch-a", 0), confirmed_timestamp: null });
    await earlySubscribed;
    expect(early.heads).toEqual([]);
  });

  it("forwards an actor's scope replacement and resumes that actor after reconnect", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const { socket, writer } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    harness.transport.selectActor("0x000111");
    expect(socket.sent.at(-1)).toEqual({ type: "select_actor", actor: "0x111", visit: null });
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

  it("visits another realm as one actor/visit pair, resumes it after reconnect and leaves it whole", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const gates: GameSyncSnapshotState[] = [];
    harness.handlers.onSnapshotState = (state) => void gates.push(state);
    const { socket, writer } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    harness.transport.selectActor("0x111");
    socket.receive({ type: "scope", epoch: "epoch-a:1", seq: 1, actor: "0x111", expedition: true, set: [] });
    await Promise.resolve();
    expect(gates.at(-1)).toMatchObject({ complete: true, actor: "0x111" });

    harness.transport.selectActor("0x111", "0x00222");
    expect(socket.sent.at(-1)).toEqual({ type: "select_actor", actor: "0x111", visit: "0x222" });
    // The gate stays shut on the actor's own scope while the visit is asked for.
    socket.receive({ type: "scope", epoch: "epoch-a:2", seq: 1, actor: "0x111", expedition: true, set: [] });
    await Promise.resolve();
    expect(gates.at(-1)).not.toMatchObject({ complete: true, visit: "0x222" });
    socket.receive({
      type: "scope",
      epoch: "epoch-a:3",
      seq: 1,
      actor: "0x111",
      visit: "0x222",
      expedition: true,
      set: [],
    });
    await Promise.resolve();
    // The store's gate opens on the visited scope only once that scope has applied.
    expect(gates.at(-1)).toMatchObject({ complete: true, actor: "0x111", visit: "0x222" });
    expect(socket.sent.filter((message) => (message as { type: string }).type === "select_actor")).toHaveLength(2);

    socket.close();
    await vi.advanceTimersByTimeAsync(200);
    const resumed = new URL(harness.urls[1]).searchParams;
    expect([resumed.get("actor"), resumed.get("visit")]).toEqual(["0x111", "0x222"]);

    harness.sockets[1].receive(hello("epoch-a:3", 2));
    harness.transport.selectActor("0x111", undefined);
    expect(harness.sockets[1].sent.at(-1)).toEqual({ type: "select_actor", actor: "0x111", visit: null });
    expect(new URL(harness.transport["options"].url).searchParams.has("visit")).toBe(false);
    harness.sockets[1].receive({
      type: "scope",
      epoch: "epoch-a:4",
      seq: 1,
      actor: "0x111",
      expedition: true,
      set: [],
    });
    await Promise.resolve();
    expect(gates.at(-1)).toMatchObject({ complete: true, actor: "0x111" });
    expect(gates.at(-1)).not.toHaveProperty("visit");
    writer.cancel();
  });

  it("keeps the gate open while the selection on screen is re-scoped, as after each move, build or deploy", async () => {
    const harness = streamHarness();
    const gates: GameSyncSnapshotState[] = [];
    harness.handlers.onSnapshotState = (state) => void gates.push(state);
    // The store applies a scope a moment after it arrives, as its ingest queue does.
    let landScope!: (applied: boolean) => void;
    harness.handlers.onScope = () => new Promise<boolean>((resolve) => (landScope = resolve));
    const { socket, writer } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    harness.transport.selectActor("0x111");
    socket.receive({ type: "scope", epoch: "epoch-a:1", seq: 1, actor: "0x111", expedition: true, set: [] });
    landScope(true);
    await Promise.resolve();
    expect(gates.at(-1)).toMatchObject({ complete: true, actor: "0x111" });

    const shownBefore = gates.length;
    socket.receive({ type: "scope", epoch: "epoch-a:2", seq: 1, actor: "0x111", expedition: true, set: [] });
    // A head lands between the new scope's arrival and its rows reaching the store.
    socket.receive({ type: "head", epoch: "epoch-a:2", seq: 2, block: 14, timestamp: 1_700 });
    landScope(true);
    await Promise.resolve();
    socket.receive({ type: "head", epoch: "epoch-a:2", seq: 3, block: 15, timestamp: 1_702 });
    expect(gates.slice(shownBefore).every((gate) => gate.complete && gate.actor === "0x111")).toBe(true);
    expect(gates.at(-1)).toMatchObject({ complete: true, timestamp: 1_702 });
    writer.cancel();
  });

  it("opens the gate with the scope's rows, so a head right behind them cannot shut it again", async () => {
    const harness = streamHarness();
    const gates: GameSyncSnapshotState[] = [];
    // The gate write itself is still queued when the head arrives.
    harness.handlers.onSnapshotState = (state) => new Promise<void>((resolve) => (gates.push(state), resolve()));
    const { socket, writer } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    harness.transport.selectActor("0x111");
    socket.receive({ type: "scope", epoch: "epoch-a:1", seq: 1, actor: "0x111", expedition: true, set: [] });
    socket.receive({ type: "head", epoch: "epoch-a:1", seq: 2, block: 14, timestamp: 1_700 });
    expect(gates.at(-1)).toMatchObject({ complete: true, actor: "0x111", timestamp: 1_700 });
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

  it("names a lost stream as unreachable while it retries, and reachable again on Herald's hello", async () => {
    vi.useFakeTimers();
    const harness = streamHarness();
    const { socket, writer } = await attached(harness, "current");
    socket.close();
    await vi.advanceTimersByTimeAsync(200);
    harness.sockets[1]!.close();
    await vi.advanceTimersByTimeAsync(200);
    expect(harness.reachability).toEqual([true, false, false]);
    harness.sockets[2]!.receive(hello("current", 0));
    expect(harness.reachability).toEqual([true, false, false, true]);
    writer.cancel();
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

  it("drops a live stream gone silent, as a slept phone's is though its socket never closed, and resumes it", async () => {
    vi.useFakeTimers();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const harness = streamHarness();
    const { socket: slept, writer } = await attached(harness, "epoch-a", 5);
    snapshot("epoch-a", 5, "0x1", 1).forEach((message) => slept.receive(message));
    // Herald's heads twice a second keep it: twenty seconds of them and the stream is the same socket.
    for (let seq = 6; seq < 46; seq += 1) {
      slept.receive({ block: seq, epoch: "epoch-a", preconfirmed: false, seq, timestamp: 100 + seq, type: "head" });
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(harness.sockets).toHaveLength(1);

    // Then nothing, and no close: the tab slept.
    await vi.advanceTimersByTimeAsync(9_000);
    expect(harness.sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(slept.closed).toBe(true);
    expect(harness.sockets).toHaveLength(2);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("Nothing heard for 10000ms"));

    const woken = harness.sockets[1]!;
    woken.receive(hello("epoch-a", 60));
    expect(woken.sent).toEqual([{ epoch: "epoch-a", seq: 45, type: "resume" }]);
    woken.receive({ block: 61, epoch: "epoch-a", preconfirmed: false, seq: 46, timestamp: 9_000, type: "head" });
    expect(harness.heads.at(-1)).toMatchObject({ block: 61, timestamp: 9_000 });
    expect(harness.reachability).toEqual([true, false, true]);
    writer.cancel();
    warning.mockRestore();
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

  it("fails the session start, naming it, when a frame that is not JSON arrives before the first snapshot", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const harness = streamHarness();
    const { socket, writer } = await attached(harness);
    socket.onmessage?.({ data: '{"type":"snapshot","epoch":"epoch-a"' });
    expect(harness.startFailures).toHaveLength(1);
    expect(harness.startFailures[0]!.message).toMatch(/JSON/);
    writer.cancel();
    error.mockRestore();
  });

  it("recovers from a frame that is not JSON after the first snapshot through a fresh snapshot", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const harness = streamHarness();
    const { socket, writer } = await attached(harness);
    snapshot("epoch-a", 0, "0x1", 1).forEach((message) => socket.receive(message));
    socket.onmessage?.({ data: '{"type":"diff","epoch":"epoch-a","seq":1,"set":[' });
    expect(harness.factBatches()).toHaveLength(0);
    expect(harness.startFailures).toHaveLength(0);
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
    writer.cancel();
    error.mockRestore();
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
