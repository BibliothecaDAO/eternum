// @vitest-environment node

import type { Config } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configManager } from "../managers/config-manager";
import { disposeActiveGameSyncRuntime, getActiveGameSyncRuntime } from "../sync/game-sync-runtime";
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

// setup() builds the world contract from the manifest ABI; a Cairo 1 interface marker is all starknet needs offline.
const offlineManifest = {
  world: { address: "0x1", abi: [{ type: "interface", name: "IWorld", items: [] }] },
  contracts: [],
};

const hello = { confirmed_block: 12, epoch: "epoch-a", preconfirmed_block: null, seq: 0, type: "hello" };
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
      namespace: "s2",
      worldAddress: "0x1",
      contractsBySelector: {},
      playerAccountClassHash: "0x2",
      playerRegistryAddress: "0x3",
      bindingAuthorityAddress: "0x4",
    },
    gameId: 54,
    presetId: 2,
    dojoConfig: { rpcUrl: "http://127.0.0.1:1", manifest: offlineManifest as never },
    setupEnvironment: { vrfProviderAddress: "0x0" },
    scheduler,
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    resolveGameConfig: () => ({}) as Config,
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
  it("selects the game before the session starts and applies config after the snapshot", async () => {
    const order: string[] = [];
    const original = { setActiveGame: configManager.setActiveGame, setDojo: configManager.setDojo };
    vi.spyOn(configManager, "setActiveGame").mockImplementation((gameId, presetId) => {
      order.push(`set-active-game:${gameId}:${presetId}`);
      original.setActiveGame.call(configManager, gameId, presetId);
    });
    vi.spyOn(configManager, "setDojo").mockImplementation((components, config) => {
      order.push("set-dojo");
      original.setDojo.call(configManager, components, config);
    });
    const harness = createHarness({
      socketFactory: () => {
        order.push("subscribe");
        const socket = new FakeSocket();
        harness.sockets.push(socket);
        return socket;
      },
    });

    const creation = createGameClient(harness.input);
    await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
    const socket = harness.sockets[0]!;
    socket.receive(hello);
    await flushMicrotasks();
    order.push("snapshot-end");
    socket.receive(snapshotEnd);
    const client = await harness.settle(creation);

    expect(order).toEqual(["set-active-game:54:2", "subscribe", "snapshot-end", "set-dojo"]);
    expect(client.runtime.getStatus()).toBe("running");
    expect(getActiveGameSyncRuntime()).toBe(client.runtime);
    expect(client.runtime.getWorldSpatialProjection()).toBe(client.projection);

    client.dispose();
    expect(socket.closed).toBe(true);
    expect(getActiveGameSyncRuntime()).toBeNull();
  });

  it("dispose() clears a pending reconnect so no timer outlives the client", async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const creation = createGameClient(harness.input);
    await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
    harness.sockets[0]!.receive(hello);
    await flushMicrotasks();
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
