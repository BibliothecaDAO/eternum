// @vitest-environment node

import type { NativeWorldBindings } from "@bibliothecadao/types";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { hash, type AccountInterface } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";

import { disposeActiveGameSyncRuntime, installFreshGameSyncRuntime } from "../sync/game-sync-runtime";
import type { HeraldSocket } from "../sync/herald-game-sync-transport";
import { createManualGameSyncScheduler } from "../sync/scheduler";
import { createGameClient, type CreateGameClientInput } from "./game-client";
import { ActionOutcomeUnreportedError } from "./transaction-outcome";
import * as shardMetadata from "./shard";

class FakeSocket implements HeraldSocket {
  public onclose: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public onmessage: ((event: { data: unknown }) => void) | null = null;
  public onopen: (() => void) | null = null;
  public closed = false;

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }

  public send(): void {}

  public receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const hello = {
  confirmed_block: 12,
  confirmed_timestamp: 1_790_000_000,
  epoch: "epoch-a",
  preconfirmed_block: null,
  seq: 0,
  type: "hello",
};
const rulesSnapshot = {
  type: "snapshot",
  epoch: "epoch-a",
  seq: 0,
  model: "SliceRules",
  rows: [{ key: hash.computePoseidonHashOnElements([54]), value: { ...preset.rules, game_id: 54 } }],
};
const releaseSnapshot = {
  type: "snapshot",
  epoch: "epoch-a",
  seq: 0,
  model: "GameRelease",
  rows: [
    {
      key: hash.computePoseidonHashOnElements([54]),
      value: { game_id: 54, release_id: 1, preset_commitment: "0x789" },
    },
  ],
};
const snapshotEnd = { epoch: "epoch-a", seq: 0, type: "snapshot_end" };

const flushMicrotasks = async (count = 8): Promise<void> => {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
};

const createHarness = (overrides: Partial<CreateGameClientInput> = {}) => {
  const sockets: FakeSocket[] = [];
  const scheduler = createManualGameSyncScheduler();
  const input: CreateGameClientInput = {
    shard: {
      url: "http://herald.test",
      chainId: "0x1",
      releaseSchemas: { "1": bindings.schemaIdentity },
      rpcUrl: "http://127.0.0.1:1",
      admissionUrl: "http://admission.test",
      accountClassHash: "0x2",
      guardianPublicKey: "0x3",
      contracts: { games: "0x1" },
      worldAddress: "0x1",
    },
    gameId: 54,
    presetId: 2,
    native: {
      bindings: bindings as unknown as NativeWorldBindings,
      chainId: "0x1",
      signIntent: vi.fn(),
      submitIntent: vi.fn(),
    },
    scheduler,
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    ...overrides,
  };

  const manifest = {
    version: 1,
    ...input.shard,
    releaseSchemas: { "1": bindings.schemaIdentity, "2": bindings.schemaIdentity },
  };
  const fetchManifest = vi.fn(async () => new Response(JSON.stringify(manifest)));
  vi.stubGlobal("fetch", fetchManifest);

  const settle = async <T>(promise: Promise<T>): Promise<T> => {
    let settled = false;
    const tracked = promise.finally(() => {
      settled = true;
    });
    for (let round = 0; round < 50 && !settled; round += 1) {
      scheduler.flushNext();
      await flushMicrotasks();
    }
    return tracked;
  };

  return { input, sockets, settle, fetchManifest, manifest };
};

afterEach(() => {
  disposeActiveGameSyncRuntime();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const actionNonce = (epoch: string, nextNonce: number) => ({
  type: "snapshot",
  epoch,
  seq: 0,
  model: "ActionNonce",
  rows: [
    {
      key: hash.computePoseidonHashOnElements([54, 0x111]),
      value: { game_id: 54, actor: "0x111", next_nonce: String(nextNonce) },
    },
  ],
});

const bootClient = async (harness: ReturnType<typeof createHarness>) => {
  const creation = createGameClient(harness.input);
  await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
  harness.sockets[0]!.receive(hello);
  await flushMicrotasks();
  harness.sockets[0]!.receive(rulesSnapshot);
  harness.sockets[0]!.receive(releaseSnapshot);
  harness.sockets[0]!.receive(snapshotEnd);
  return harness.settle(creation);
};

describe("createGameClient", () => {
  it("keeps every client in one process live: each owns its runtime", async () => {
    const first = createHarness({ actor: "0x111" });
    const second = createHarness({ actor: "0x222" });
    const firstClient = await bootClient(first);
    const secondClient = await bootClient(second);

    expect(first.sockets[0]!.closed).toBe(false);
    expect(firstClient.runtime.getStatus()).toBe("running");
    expect(secondClient.runtime.getStatus()).toBe("running");
    firstClient.dispose();
    expect(second.sockets[0]!.closed).toBe(false);
    secondClient.dispose();
  });

  it("submits nonce zero after a complete actor snapshot with no ActionNonce row", async () => {
    const harness = createHarness({ actor: "0x111" });
    const client = await bootClient(harness);
    vi.mocked(harness.input.native.signIntent).mockResolvedValue(["0x1", "0x2"]);
    vi.mocked(harness.input.native.submitIntent).mockResolvedValue({ transaction_hash: "0xabc", order: 1n });
    void client.setup.network.provider
      .submitCommand({ address: "0x111" } as AccountInterface, {
        kind: "Explore",
        value: { explorer_id: 9, direction: 2 },
      })
      .catch(() => undefined);
    await vi.waitFor(() => expect(harness.input.native.submitIntent).toHaveBeenCalledOnce());
    const action = vi.mocked(harness.input.native.submitIntent).mock.calls[0]![0];
    expect(BigInt(action.intent[6]!)).toBe(0n);
    expect(client.setup.store.get("ActionNonce", { game_id: 54, actor: 0x111n })).toBeUndefined();
    client.dispose();
  });

  it("waits for a newly selected actor's empty scope to reach the store before signing", async () => {
    const harness = createHarness({ actor: "0x111" });
    const client = await bootClient(harness);
    vi.mocked(harness.input.native.signIntent).mockResolvedValue(["0x1", "0x2"]);
    vi.mocked(harness.input.native.submitIntent).mockResolvedValue({ transaction_hash: "0xabc", order: 1n });
    const send = vi.spyOn(harness.sockets[0]!, "send");
    void client.setup.network.provider
      .submitCommand({ address: "0x222" } as AccountInterface, {
        kind: "Explore",
        value: { explorer_id: 9, direction: 2 },
      })
      .catch(() => undefined);
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(JSON.stringify({ type: "select_actor", actor: "0x222" })));
    expect(harness.input.native.signIntent).not.toHaveBeenCalled();
    harness.sockets[0]!.receive({
      type: "scope",
      epoch: "epoch-a",
      seq: 0,
      actor: "0x222",
      expedition: false,
      set: [],
    });
    await flushMicrotasks();
    expect(harness.input.native.signIntent).not.toHaveBeenCalled();
    await harness.settle(vi.waitFor(() => expect(harness.input.native.submitIntent).toHaveBeenCalledOnce()));
    const action = vi.mocked(harness.input.native.submitIntent).mock.calls[0]![0];
    expect(BigInt(action.intent[5]!)).toBe(0x222n);
    expect(BigInt(action.intent[6]!)).toBe(0n);
    client.dispose();
  });

  it("opens and submits a release-1 game when the shard's current release is 2", async () => {
    const harness = createHarness();
    harness.fetchManifest.mockResolvedValue(new Response(JSON.stringify({ ...harness.manifest, releaseId: "2" })));
    harness.input.shard = await shardMetadata.openShard("http://herald.test", bindings.schemaIdentity);
    const creation = createGameClient(harness.input);
    await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
    const socket = harness.sockets[0]!;
    socket.receive(hello);
    await flushMicrotasks();
    for (const message of [rulesSnapshot, releaseSnapshot, actionNonce("epoch-a", 0), snapshotEnd])
      socket.receive(message);
    const client = await harness.settle(creation);
    vi.mocked(harness.input.native.signIntent).mockResolvedValue(["0x1", "0x2"]);
    vi.mocked(harness.input.native.submitIntent).mockResolvedValue({ transaction_hash: "0xabc", order: 1n });
    void client.setup.network.provider
      .submitCommand({ address: "0x111" } as AccountInterface, {
        kind: "Explore",
        value: { explorer_id: 9, direction: 2 },
      })
      .catch(() => undefined);
    await vi.waitFor(() => expect(harness.input.native.submitIntent).toHaveBeenCalledOnce());
    const action = vi.mocked(harness.input.native.submitIntent).mock.calls[0]![0];
    expect(BigInt(action.intent[8]!)).toBe(1n);
    expect(harness.fetchManifest).toHaveBeenCalledOnce();
    expect(harness.fetchManifest.mock.calls[0]).toEqual(["http://herald.test/manifest", expect.any(Object)]);
    expect(socket.closed).toBe(false);
    client.dispose();
  });

  it.each(["503", "timeout"])("retries a transient manifest %s without tearing down the live game", async (failure) => {
    vi.useFakeTimers();
    const onLiveApplyFailed = vi.fn();
    const harness = createHarness({ observer: { onLiveApplyFailed } });
    const creation = createGameClient(harness.input);
    await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
    const socket = harness.sockets[0]!;
    socket.receive(hello);
    await flushMicrotasks();
    for (const message of [rulesSnapshot, releaseSnapshot, actionNonce("epoch-a", 0), snapshotEnd])
      socket.receive(message);
    const client = await harness.settle(creation);
    if (failure === "503") harness.fetchManifest.mockResolvedValueOnce(new Response("temporary", { status: 503 }));
    else harness.fetchManifest.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    client.setup.store.applyFacts([
      {
        model: "GameRelease",
        key: releaseSnapshot.rows[0]!.key,
        value: { game_id: 54, release_id: 2, preset_commitment: "0x789" },
      },
    ]);
    await flushMicrotasks(30);
    vi.mocked(harness.input.native.signIntent).mockResolvedValue(["0x1", "0x2"]);
    vi.mocked(harness.input.native.submitIntent).mockResolvedValue({ transaction_hash: "0xabc", order: 1n });
    void client.setup.network.provider
      .submitCommand({ address: "0x111" } as AccountInterface, {
        kind: "Explore",
        value: { explorer_id: 9, direction: 2 },
      })
      .catch(() => undefined);
    await flushMicrotasks();
    expect(harness.input.native.signIntent).not.toHaveBeenCalled();
    expect(socket.closed).toBe(false);
    expect(onLiveApplyFailed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(harness.input.native.submitIntent).toHaveBeenCalledOnce());
    expect(harness.fetchManifest).toHaveBeenCalledTimes(2);
    expect(socket.closed).toBe(false);
    expect(onLiveApplyFailed).not.toHaveBeenCalled();
    client.dispose();
  });
  it("holds new signatures until the changed game release has a known decoder", async () => {
    const harness = createHarness();
    const creation = createGameClient(harness.input);
    await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
    const socket = harness.sockets[0]!;
    socket.receive(hello);
    await flushMicrotasks();
    for (const message of [rulesSnapshot, releaseSnapshot, actionNonce("epoch-a", 0), snapshotEnd])
      socket.receive(message);
    const client = await harness.settle(creation);
    let finishRefresh!: () => void;
    harness.fetchManifest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = () => resolve(new Response(JSON.stringify(harness.manifest)));
        }),
    );
    socket.receive({
      type: "diff",
      epoch: "epoch-a",
      seq: 1,
      block: 13,
      preconfirmed: false,
      del: [],
      set: [
        {
          model: "GameRelease",
          key: releaseSnapshot.rows[0]!.key,
          value: { game_id: 54, release_id: 2, preset_commitment: "0x789" },
        },
      ],
    });
    await harness.settle(Promise.resolve());
    await vi.waitFor(() => expect(harness.fetchManifest).toHaveBeenCalledOnce());
    const stopped = new Error("signature reached");
    vi.mocked(harness.input.native.signIntent).mockRejectedValueOnce(stopped);
    const failure = new Promise<{ error: unknown }>((resolve) =>
      client.setup.network.provider.once("transactionFailed", resolve),
    );
    void client.setup.network.provider
      .submitCommand({ address: "0x111" } as AccountInterface, {
        kind: "Explore",
        value: { explorer_id: 9, direction: 2 },
      })
      .catch(() => undefined);
    await flushMicrotasks();
    expect(harness.input.native.signIntent).not.toHaveBeenCalled();
    finishRefresh();
    await vi.waitFor(() => expect(harness.input.native.signIntent).toHaveBeenCalledOnce());
    expect((await failure).error).toBe(stopped);
    client.dispose();
  });

  it("tears down the subscription when a changed release has no decoder", async () => {
    const onLiveApplyFailed = vi.fn();
    const harness = createHarness({ observer: { onLiveApplyFailed } });
    const creation = createGameClient(harness.input);
    await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
    const socket = harness.sockets[0]!;
    socket.receive(hello);
    await flushMicrotasks();
    for (const message of [rulesSnapshot, releaseSnapshot, snapshotEnd]) socket.receive(message);
    const client = await harness.settle(creation);
    harness.fetchManifest.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ...harness.manifest, releaseSchemas: { "1": bindings.schemaIdentity, "2": "unknown" } }),
      ),
    );
    socket.receive({
      type: "diff",
      epoch: "epoch-a",
      seq: 1,
      block: 13,
      preconfirmed: false,
      del: [],
      set: [
        {
          model: "GameRelease",
          key: releaseSnapshot.rows[0]!.key,
          value: { game_id: 54, release_id: 2, preset_commitment: "0x789" },
        },
      ],
    });
    await harness.settle(Promise.resolve());
    await vi.waitFor(() =>
      expect(onLiveApplyFailed).toHaveBeenCalledWith(expect.any(shardMetadata.ShardReleaseMismatchError)),
    );
    expect(socket.closed).toBe(true);
    expect(harness.input.native.signIntent).not.toHaveBeenCalled();
    client.dispose();
  });

  it("dispose() clears a pending reconnect so no timer outlives the client", async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const creation = createGameClient(harness.input);
    await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
    harness.sockets[0]!.receive(hello);
    await flushMicrotasks();
    harness.sockets[0]!.receive(rulesSnapshot);
    harness.sockets[0]!.receive(releaseSnapshot);
    harness.sockets[0]!.receive(snapshotEnd);
    const client = await harness.settle(creation);

    harness.sockets[0]!.close();
    expect(vi.getTimerCount()).toBe(1);
    client.dispose();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(harness.sockets).toHaveLength(1);
  });

  it("waits for a confirmed head before the client is ready, so nothing reads chain time before it is known", async () => {
    const harness = createHarness();
    let ready = false;
    const creation = createGameClient(harness.input).then((client) => {
      ready = true;
      return client;
    });
    await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
    // A Herald yet to see a confirmed head names no time in its hello.
    harness.sockets[0]!.receive({ ...hello, confirmed_timestamp: null });
    await flushMicrotasks();
    harness.sockets[0]!.receive(rulesSnapshot);
    harness.sockets[0]!.receive(releaseSnapshot);
    harness.sockets[0]!.receive(snapshotEnd);
    for (let round = 0; round < 20; round += 1) {
      harness.input.scheduler!.flushNext();
      await flushMicrotasks();
    }
    expect(ready).toBe(false);

    harness.sockets[0]!.receive({ type: "head", epoch: "epoch-a", seq: 1, block: 13, timestamp: 1_790_000_010 });
    const client = await harness.settle(creation);
    expect(ready).toBe(true);
    client.dispose();
  });

  it("tearing down the active runtime fails a subscribe that never resolved and leaves no timer", async () => {
    vi.useFakeTimers();
    // The web app's client: its runtime is the active one.
    const harness = createHarness({ createRuntime: installFreshGameSyncRuntime });
    const creation = createGameClient(harness.input);
    await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));

    // What configManager.setActiveGame and the web client's bootstrap reset do to the previous game.
    disposeActiveGameSyncRuntime();

    await expect(creation).rejects.toThrow("Herald transport was disposed");
    expect(harness.sockets[0]!.closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(harness.sockets).toHaveLength(1);
  });
  it("releases an action recorded while Herald restarted, so the player's next action still signs", async () => {
    vi.useFakeTimers();
    const submitIntent = vi.fn(async () => ({ transaction_hash: "0xabc", order: 1n }));
    const harness = createHarness();
    harness.input.native = { ...harness.input.native, signIntent: vi.fn(async () => ["0x1", "0x2"]), submitIntent };
    const creation = createGameClient(harness.input);
    await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
    harness.sockets[0]!.receive(hello);
    await flushMicrotasks();
    for (const message of [rulesSnapshot, releaseSnapshot, actionNonce("epoch-a", 0), snapshotEnd])
      harness.sockets[0]!.receive(message);
    const client = await harness.settle(creation);
    const provider = client.setup.network.provider;
    const signer = { address: "0x111" } as AccountInterface;
    const explore = { kind: "Explore", value: { explorer_id: 9, direction: 2 } } as const;

    const failed = new Promise<{ error: unknown }>((resolve) => provider.once("transactionFailed", resolve));
    void provider.submitCommand(signer, explore);
    await vi.waitFor(() => expect(submitIntent).toHaveBeenCalledOnce());

    // Herald restarts: the action is recorded while it is down, and the new Herald never streams its status.
    harness.sockets[0]!.close();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(harness.sockets).toHaveLength(2);
    const restarted = { ...hello, epoch: "epoch-b", confirmed_block: 13 };
    harness.sockets[1]!.receive(restarted);
    await flushMicrotasks();
    for (const message of [
      { ...rulesSnapshot, epoch: "epoch-b" },
      { ...releaseSnapshot, epoch: "epoch-b" },
      actionNonce("epoch-b", 1),
      { ...snapshotEnd, epoch: "epoch-b" },
    ])
      harness.sockets[1]!.receive(message);

    expect((await harness.settle(failed)).error).toBeInstanceOf(ActionOutcomeUnreportedError);
    void provider.submitCommand(signer, explore).catch(() => undefined);
    await vi.waitFor(() => expect(submitIntent).toHaveBeenCalledTimes(2));
    client.dispose();
  });
});
