// @vitest-environment node

import type { NativeWorldBindings } from "@bibliothecadao/types";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-3.json";
import { hash, type AccountInterface } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";

import { disposeActiveGameSyncRuntime } from "../sync/game-sync-runtime";
import type { HeraldSocket } from "../sync/herald-game-sync-transport";
import { createManualGameSyncScheduler } from "../sync/scheduler";
import { createGameClient, type CreateGameClientInput } from "./game-client";
import { ActionOutcomeUnreportedError } from "./transaction-outcome";

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
      releaseId: bindings.schemaIdentity,
      rpcUrl: "http://127.0.0.1:1",
      admissionUrl: "http://admission.test",
      accountClassHash: "0x2",
      contracts: { season: "0x1" },
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

  return { input, sockets, settle };
};

afterEach(() => {
  disposeActiveGameSyncRuntime();
  vi.restoreAllMocks();
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

describe("createGameClient", () => {
  it("dispose() clears a pending reconnect so no timer outlives the client", async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const creation = createGameClient(harness.input);
    await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
    harness.sockets[0]!.receive(hello);
    await flushMicrotasks();
    harness.sockets[0]!.receive(rulesSnapshot);
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
    const harness = createHarness();
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
    for (const message of [rulesSnapshot, actionNonce("epoch-a", 0), snapshotEnd]) harness.sockets[0]!.receive(message);
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
