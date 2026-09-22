// @vitest-environment node

import type { NativeWorldBindings } from "@bibliothecadao/types";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-3.json";
import { hash } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";

import { disposeActiveGameSyncRuntime } from "../sync/game-sync-runtime";
import type { HeraldSocket } from "../sync/herald-game-sync-transport";
import { createManualGameSyncScheduler } from "../sync/scheduler";
import { createGameClient, type CreateGameClientInput } from "./game-client";

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

// Offline deployment identity is checked against the same generated schema as a live deployment.
const offlineManifest = {
  world: { address: "0x1", abi: [{ type: "interface", name: "IWorld", items: [] }] },
  contracts: [],
  native: { activeSchema: bindings.schemaIdentity },
};

const hello = { confirmed_block: 12, epoch: "epoch-a", preconfirmed_block: null, seq: 0, type: "hello" };
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
    world: {
      id: "blitz",
      chain: "madara",
      rpcUrl: "http://127.0.0.1:1",
      heraldBaseUrl: "http://herald.test",
      admissionUrl: "http://admission.test",
      worldAddress: "0x1",
      contractsBySelector: {},
      playerAccountClassHash: "0x2",
      playerRegistryAddress: "0x3",
      bindingAuthorityAddress: "0x4",
    },
    gameId: 54,
    presetId: 2,
    networkConfig: { rpcUrl: "http://127.0.0.1:1", manifest: offlineManifest as never },
    setupEnvironment: {},
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
});
