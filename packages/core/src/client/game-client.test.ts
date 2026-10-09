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
      accountClassHash: "0x2",
      guardianPublicKey: "0x3",
      contracts: { games: "0x1" },
      worldAddress: "0x1",
      l2GasBound: 0x47868c00n,
    },
    gameId: 54,
    presetId: 2,
    bindings: bindings as unknown as NativeWorldBindings,
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
    l2GasBound: "0x47868c00",
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

/** The player's own account: it signs and sends the play invoke itself. */
const playerAccount = (address = "0x111") => {
  const execute = vi.fn(async (..._args: unknown[]) => ({ transaction_hash: "0xabc" }));
  return { account: { address, execute } as unknown as AccountInterface, execute };
};
const explore = { kind: "Explore", value: { explorer_id: 9, direction: 2 } } as const;
/** The play call's calldata: game, release id, preset commitment, then the command span. */
const playCalldata = (execute: ReturnType<typeof playerAccount>["execute"]) =>
  (execute.mock.calls[0]![0] as { calldata: string[] }).calldata;

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

  it("sends a command as the player's own play invoke, pinned to the game's release", async () => {
    const harness = createHarness({ actor: "0x111" });
    const client = await bootClient(harness);
    const { account, execute } = playerAccount();
    void client.setup.network.provider.submitCommand(account, explore).catch(() => undefined);
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
    expect(execute.mock.calls[0]![0]).toMatchObject({ contractAddress: "0x1", entrypoint: "play" });
    expect(playCalldata(execute).slice(0, 3)).toEqual(["54", "1", String(0x789n)]);
    client.dispose();
  });

  it("visits a realm for a spectator or a connected player, and connecting again leaves the visit", async () => {
    const harness = createHarness({ actor: "0x111" });
    const client = await bootClient(harness);
    const send = vi.spyOn(harness.sockets[0]!, "send");
    // A spectator watches a realm: the stream carries it alone, with no actor.
    client.visit("0x222");
    expect(send).toHaveBeenLastCalledWith(JSON.stringify({ type: "select_actor", actor: null, visit: "0x222" }));
    client.connect({ address: "0x111" } as AccountInterface);
    client.visit("0x222");
    expect(send).toHaveBeenLastCalledWith(JSON.stringify({ type: "select_actor", actor: "0x111", visit: "0x222" }));
    client.connect({ address: "0x111" } as AccountInterface);
    expect(send).toHaveBeenLastCalledWith(JSON.stringify({ type: "select_actor", actor: "0x111", visit: null }));
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
    for (const message of [rulesSnapshot, releaseSnapshot, snapshotEnd]) socket.receive(message);
    const client = await harness.settle(creation);
    const { account, execute } = playerAccount();
    void client.setup.network.provider.submitCommand(account, explore).catch(() => undefined);
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
    expect(playCalldata(execute)[1]).toBe("1");
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
    for (const message of [rulesSnapshot, releaseSnapshot, snapshotEnd]) socket.receive(message);
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
    const { account, execute } = playerAccount();
    void client.setup.network.provider.submitCommand(account, explore).catch(() => undefined);
    await flushMicrotasks();
    expect(execute).not.toHaveBeenCalled();
    expect(socket.closed).toBe(false);
    expect(onLiveApplyFailed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
    expect(harness.fetchManifest).toHaveBeenCalledTimes(2);
    expect(socket.closed).toBe(false);
    expect(onLiveApplyFailed).not.toHaveBeenCalled();
    client.dispose();
  });
  it("holds new invokes until the changed game release has a known decoder", async () => {
    const harness = createHarness();
    const creation = createGameClient(harness.input);
    await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
    const socket = harness.sockets[0]!;
    socket.receive(hello);
    await flushMicrotasks();
    for (const message of [rulesSnapshot, releaseSnapshot, snapshotEnd]) socket.receive(message);
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
    const { account, execute } = playerAccount();
    void client.setup.network.provider.submitCommand(account, explore).catch(() => undefined);
    await flushMicrotasks();
    expect(execute).not.toHaveBeenCalled();
    finishRefresh();
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
    expect(playCalldata(execute)[1]).toBe("2");
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
});
