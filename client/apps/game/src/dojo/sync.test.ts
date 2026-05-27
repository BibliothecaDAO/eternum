// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const { getEntitiesMock, setEntitiesMock } = vi.hoisted(() => ({
  getEntitiesMock: vi.fn(),
  setEntitiesMock: vi.fn(),
}));

vi.mock("@dojoengine/state", () => ({
  getEntities: getEntitiesMock,
  setEntities: setEntitiesMock,
}));

vi.mock("@bibliothecadao/eternum", () => ({
  MAP_DATA_REFRESH_INTERVAL: 1_000,
  MapDataStore: {
    getInstance: vi.fn(() => ({
      refresh: vi.fn(),
    })),
  },
  recordArmyMovementLatencyPhase: vi.fn(),
  tileOptToTile: vi.fn(),
}));

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: {
    getState: vi.fn(() => ({ account: null })),
  },
}));

vi.mock("@/hooks/store/use-connection-store", () => ({
  useConnectionStore: {
    getState: vi.fn(() => ({
      recordGlobalHandshake: vi.fn(),
      recordGlobalUpdate: vi.fn(),
      recordSpatialHandshake: vi.fn(),
      recordSpatialUpdate: vi.fn(),
    })),
  },
}));

vi.mock("@/services/api", () => ({
  sqlApi: {
    fetchFirstStructure: vi.fn(),
    fetchPlayerStructures: vi.fn(),
  },
}));

vi.mock("./queries", () => ({
  getAddressNamesFromTorii: vi.fn(),
  getBankStructuresFromTorii: vi.fn(),
  getConfigFromTorii: vi.fn(),
  getGuildsFromTorii: vi.fn(),
  getStructuresDataFromTorii: vi.fn(),
}));

vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS: 8_000,
  },
}));

vi.mock("./sync-initial-selection", () => ({
  resolveInitialStructureSelection: vi.fn(() => ({ selectedStructure: null, spectator: false })),
}));

vi.mock("./sync-utils", () => ({
  isDeletionPayload: vi.fn(
    (entity: { models?: Record<string, unknown> }) => Object.keys(entity.models ?? {}).length === 0,
  ),
}));

vi.mock("./torii-stream-manager", () => ({
  buildModelKeysClause: vi.fn((models: Array<{ model: string }>) => ({
    mocked: "model-stream-clause",
    models: models.map(({ model }) => model),
  })),
}));

import { cancelEntityStreamSubscription, initialSync, syncEntitiesDebounced } from "./sync";

type ToriiEntityStub = {
  hashed_keys: string;
  models: Record<string, unknown>;
};

type EntityUpdatedCallback = (entity: ToriiEntityStub) => void;

function createSyncHarness() {
  let onEntityUpdated: EntityUpdatedCallback | null = null;
  const onEntityUpdatedCallbacks: EntityUpdatedCallback[] = [];
  const cancelEntitySubscription = vi.fn();
  const cancelEventSubscription = vi.fn();
  const entitySubscription = { cancel: cancelEntitySubscription };
  const eventSubscription = { cancel: cancelEventSubscription };

  const client = {
    onEntityUpdated: vi.fn(async (_clause, callback: EntityUpdatedCallback) => {
      onEntityUpdated = callback;
      onEntityUpdatedCallbacks.push(callback);
      return entitySubscription;
    }),
    onEventMessageUpdated: vi.fn(async () => eventSubscription),
    updateEntitySubscription: vi.fn(async () => undefined),
    updateEventMessageSubscription: vi.fn(async () => undefined),
  };

  const setup = {
    network: {
      toriiClient: client,
      contractComponents: [],
      world: {
        components: {},
        deleteEntity: vi.fn(),
      },
    },
  };

  const emitEntityUpdate = (entity: ToriiEntityStub, index = 0) => {
    const callback = onEntityUpdatedCallbacks[index] ?? onEntityUpdated;
    if (!callback) {
      throw new Error("entity subscription was not created");
    }
    callback(entity);
  };

  return {
    cancelEntitySubscription,
    cancelEventSubscription,
    client,
    emitEntityUpdate,
    onEntityUpdatedCallbacks,
    setup,
  };
}

const flushMicrotasks = async (count = 4) => {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
};

function createInitialSyncState() {
  return {
    structureEntityId: 0,
    setStructureEntityId: vi.fn(),
  };
}

describe("syncEntitiesDebounced", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("resolves ready after the first entity update is written to RECS", async () => {
    vi.useFakeTimers();
    const harness = createSyncHarness();
    const subscription = await syncEntitiesDebounced(harness.client as any, harness.setup as any, null, false);
    let readyResolved = false;

    subscription.ready.then(() => {
      readyResolved = true;
    });

    harness.emitEntityUpdate({
      hashed_keys: "entity-1",
      models: {
        "s1_eternum-Structure": { entity_id: 1 },
      },
    });

    await vi.advanceTimersByTimeAsync(199);
    expect(readyResolved).toBe(false);
    expect(setEntitiesMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await subscription.ready;

    expect(readyResolved).toBe(true);
    expect(setEntitiesMock).toHaveBeenCalledWith(
      [
        {
          hashed_keys: "entity-1",
          models: {
            "s1_eternum-Structure": { entity_id: 1 },
          },
        },
      ],
      harness.setup.network.world.components,
      false,
    );
  });

  it("waits for a matching ready entity before resolving ready", async () => {
    vi.useFakeTimers();
    const harness = createSyncHarness();
    const subscription = await syncEntitiesDebounced(
      harness.client as any,
      harness.setup as any,
      null,
      false,
      undefined,
      {
        isReadyEntity: (entity) => Boolean(entity.models["s1_eternum-TileOpt"]),
      },
    );
    let readyResolved = false;

    subscription.ready.then(() => {
      readyResolved = true;
    });

    harness.emitEntityUpdate({
      hashed_keys: "structure-1",
      models: {
        "s1_eternum-Structure": { entity_id: 1 },
      },
    });

    await vi.advanceTimersByTimeAsync(200);
    expect(readyResolved).toBe(false);

    harness.emitEntityUpdate({
      hashed_keys: "tile-1",
      models: {
        "s1_eternum-TileOpt": { col: 1, row: 2, data: "3" },
      },
    });

    await vi.advanceTimersByTimeAsync(200);
    await subscription.ready;

    expect(readyResolved).toBe(true);
  });

  it("rejects ready when canceled before the first entity update is written", async () => {
    vi.useFakeTimers();
    const harness = createSyncHarness();
    const subscription = await syncEntitiesDebounced(harness.client as any, harness.setup as any, null, false);
    const readyRejection = expect(subscription.ready).rejects.toThrow(/cancel/i);

    subscription.cancel();

    await readyRejection;
    expect(harness.cancelEntitySubscription).toHaveBeenCalledTimes(1);
    expect(harness.cancelEventSubscription).toHaveBeenCalledTimes(1);
  });

  it("updates the active Torii subscription pair without recreating callbacks", async () => {
    const harness = createSyncHarness();
    const initialClause = { initial: true };
    const updatedClause = { updated: true };

    const subscription = await syncEntitiesDebounced(
      harness.client as any,
      harness.setup as any,
      initialClause as any,
      false,
    );

    expect(subscription.updateClause).toEqual(expect.any(Function));

    await subscription.updateClause?.(updatedClause as any);

    expect(harness.client.onEntityUpdated).toHaveBeenCalledTimes(1);
    expect(harness.client.onEventMessageUpdated).toHaveBeenCalledTimes(1);
    expect(harness.client.updateEntitySubscription).toHaveBeenCalledWith(
      expect.objectContaining({ cancel: harness.cancelEntitySubscription }),
      updatedClause,
    );
    expect(harness.client.updateEventMessageSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ cancel: harness.cancelEventSubscription }),
      updatedClause,
    );
  });

  it("can keep entity and event subscription clauses separate", async () => {
    const harness = createSyncHarness();
    const entityClause = { entity: true };
    const eventClause = { event: true };
    const updatedEntityClause = { entity: "updated" };
    const updatedEventClause = { event: "updated" };

    const subscription = await syncEntitiesDebounced(
      harness.client as any,
      harness.setup as any,
      { entityClause, eventClause } as any,
      false,
    );

    expect(harness.client.onEntityUpdated).toHaveBeenCalledWith(entityClause, expect.any(Function));
    expect(harness.client.onEventMessageUpdated).toHaveBeenCalledWith(eventClause, expect.any(Function));

    await subscription.updateClause?.({ entityClause: updatedEntityClause, eventClause: updatedEventClause } as any);

    expect(harness.client.updateEntitySubscription).toHaveBeenCalledWith(
      expect.objectContaining({ cancel: harness.cancelEntitySubscription }),
      updatedEntityClause,
    );
    expect(harness.client.updateEventMessageSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ cancel: harness.cancelEventSubscription }),
      updatedEventClause,
    );
  });

  it("keeps a partial clause pair scoped to the provided side", async () => {
    const harness = createSyncHarness();
    const entityClause = { entity: true };
    const eventClause = { event: true };

    await syncEntitiesDebounced(harness.client as any, harness.setup as any, { entityClause } as any, false);

    expect(harness.client.onEntityUpdated).toHaveBeenCalledWith(entityClause, expect.any(Function));
    expect(harness.client.onEventMessageUpdated).toHaveBeenCalledWith(entityClause, expect.any(Function));

    await syncEntitiesDebounced(harness.client as any, harness.setup as any, { eventClause } as any, false);

    expect(harness.client.onEntityUpdated).toHaveBeenLastCalledWith(eventClause, expect.any(Function));
    expect(harness.client.onEventMessageUpdated).toHaveBeenLastCalledWith(eventClause, expect.any(Function));
  });

  it("waits for a fresh ready entity after updating the subscription clause", async () => {
    vi.useFakeTimers();
    const harness = createSyncHarness();
    const subscription = await syncEntitiesDebounced(
      harness.client as any,
      harness.setup as any,
      null,
      false,
      undefined,
      {
        isReadyEntity: (entity) => Boolean(entity.models["s1_eternum-TileOpt"]),
      },
    );

    harness.emitEntityUpdate({
      hashed_keys: "tile-1",
      models: {
        "s1_eternum-TileOpt": { col: 1, row: 2, data: "3" },
      },
    });
    await vi.advanceTimersByTimeAsync(200);
    await subscription.ready;

    await subscription.updateClause?.({ updated: true } as any);

    let secondReadyResolved = false;
    subscription.ready.then(() => {
      secondReadyResolved = true;
    });

    await Promise.resolve();
    expect(secondReadyResolved).toBe(false);

    harness.emitEntityUpdate({
      hashed_keys: "structure-1",
      models: {
        "s1_eternum-Structure": { entity_id: 1 },
      },
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(secondReadyResolved).toBe(false);

    harness.emitEntityUpdate({
      hashed_keys: "tile-2",
      models: {
        "s1_eternum-TileOpt": { col: 3, row: 4, data: "5" },
      },
    });
    await vi.advanceTimersByTimeAsync(200);
    await subscription.ready;

    expect(secondReadyResolved).toBe(true);
  });

  it("counts ready entities that arrive while the subscription update is in flight", async () => {
    vi.useFakeTimers();
    const harness = createSyncHarness();
    const subscription = await syncEntitiesDebounced(
      harness.client as any,
      harness.setup as any,
      null,
      false,
      undefined,
      {
        isReadyEntity: (entity) => Boolean(entity.models["s1_eternum-TileOpt"]),
      },
    );

    harness.emitEntityUpdate({
      hashed_keys: "tile-1",
      models: {
        "s1_eternum-TileOpt": { col: 1, row: 2, data: "3" },
      },
    });
    await vi.advanceTimersByTimeAsync(200);
    await subscription.ready;

    harness.client.updateEntitySubscription.mockImplementationOnce(async () => {
      harness.emitEntityUpdate({
        hashed_keys: "tile-2",
        models: {
          "s1_eternum-TileOpt": { col: 3, row: 4, data: "5" },
        },
      });
    });

    await subscription.updateClause?.({ updated: true } as any);

    let secondReadyResolved = false;
    subscription.ready.then(() => {
      secondReadyResolved = true;
    });

    await vi.advanceTimersByTimeAsync(200);
    await subscription.ready;

    expect(secondReadyResolved).toBe(true);
  });

  it("omits updateClause when the Torii client does not expose subscription update APIs", async () => {
    const harness = createSyncHarness();
    delete (harness.client as any).updateEntitySubscription;
    delete (harness.client as any).updateEventMessageSubscription;

    const subscription = await syncEntitiesDebounced(harness.client as any, harness.setup as any, null, false);

    expect(subscription.updateClause).toBeUndefined();
  });
});

describe("initialSync global streams", () => {
  afterEach(() => {
    cancelEntityStreamSubscription();
  });

  it("opens one all-entity global stream with explicitly scoped events before reporting sync complete", async () => {
    vi.useFakeTimers();
    getEntitiesMock.mockResolvedValue(undefined);
    const harness = createSyncHarness();

    const syncPromise = initialSync(harness.setup as any, createInitialSyncState() as any, vi.fn(), {
      logging: false,
      reportProgress: false,
    });

    await flushMicrotasks();
    harness.emitEntityUpdate({
      hashed_keys: "global-entity-1",
      models: {
        "s1_eternum-Guild": { entity_id: 1 },
      },
    });
    await vi.advanceTimersByTimeAsync(200);
    await syncPromise;

    expect(harness.client.onEntityUpdated).toHaveBeenCalledTimes(1);
    expect(harness.client.onEntityUpdated).toHaveBeenCalledWith(undefined, expect.any(Function));
    expect(harness.client.onEventMessageUpdated).toHaveBeenCalledTimes(1);
    expect(harness.client.onEventMessageUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        models: expect.arrayContaining([
          "s1_eternum-OpenRelicChestEvent",
          "s1_eternum-ExplorerRewardEvent",
          "s1_eternum-BattleEvent",
        ]),
      }),
      expect.any(Function),
    );
    expect(getEntitiesMock).toHaveBeenCalledTimes(1);
  });

  it("hydrates render-critical spatial rows without replaying Structure owners", async () => {
    vi.useFakeTimers();
    getEntitiesMock.mockResolvedValue(undefined);
    const harness = createSyncHarness();

    const syncPromise = initialSync(harness.setup as any, createInitialSyncState() as any, vi.fn(), {
      logging: false,
      reportProgress: false,
    });

    await flushMicrotasks();
    harness.emitEntityUpdate({
      hashed_keys: "global-entity-1",
      models: {
        "s1_eternum-Guild": { entity_id: 1 },
      },
    });
    await vi.advanceTimersByTimeAsync(200);
    await syncPromise;

    const snapshotCall = getEntitiesMock.mock.calls[0];
    expect(snapshotCall[1]).toEqual(
      expect.objectContaining({
        models: expect.arrayContaining(["s1_eternum-TileOpt", "s1_eternum-Building"]),
      }),
    );
    expect(snapshotCall[1].models).not.toContain("s1_eternum-Structure");
    expect(snapshotCall[4]).toEqual(expect.arrayContaining(["s1_eternum-TileOpt", "s1_eternum-Building"]));
    expect(snapshotCall[4]).not.toContain("s1_eternum-Structure");
  });

  it("reports sync complete after the spatial bootstrap snapshot without waiting for an entity stream flush", async () => {
    getEntitiesMock.mockClear();
    getEntitiesMock.mockResolvedValue(undefined);
    const harness = createSyncHarness();
    const syncPromise = initialSync(harness.setup as any, createInitialSyncState() as any, vi.fn(), {
      logging: false,
      reportProgress: false,
      subscriptionSetupTimeoutMs: 25,
    });
    let syncResolved = false;
    syncPromise.then(() => {
      syncResolved = true;
    });

    await flushMicrotasks(20);

    expect(syncResolved).toBe(true);
    expect(getEntitiesMock).toHaveBeenCalledTimes(1);
  });

  it("fails initial sync when the ownerless global spatial bootstrap snapshot times out", async () => {
    vi.useFakeTimers();
    getEntitiesMock.mockImplementation(() => new Promise(() => undefined));
    const harness = createSyncHarness();

    const syncPromise = initialSync(harness.setup as any, createInitialSyncState() as any, vi.fn(), {
      logging: false,
      reportProgress: false,
      subscriptionSetupTimeoutMs: 25,
    });
    const expectedRejection = expect(syncPromise).rejects.toThrow(/global spatial map bootstrap snapshot/i);

    await flushMicrotasks();
    harness.emitEntityUpdate({
      hashed_keys: "global-entity-1",
      models: {
        "s1_eternum-Guild": { entity_id: 1 },
      },
    });
    await vi.advanceTimersByTimeAsync(225);

    await expectedRejection;
  });

  it("cancels the single global stream pair after initial sync", async () => {
    vi.useFakeTimers();
    getEntitiesMock.mockResolvedValue(undefined);
    const harness = createSyncHarness();

    const syncPromise = initialSync(harness.setup as any, createInitialSyncState() as any, vi.fn(), {
      logging: false,
      reportProgress: false,
    });

    await flushMicrotasks();
    harness.emitEntityUpdate({
      hashed_keys: "global-entity-1",
      models: {
        "s1_eternum-Guild": { entity_id: 1 },
      },
    });
    await vi.advanceTimersByTimeAsync(200);
    await syncPromise;

    cancelEntityStreamSubscription();

    expect(harness.cancelEntitySubscription).toHaveBeenCalledTimes(1);
    expect(harness.cancelEventSubscription).toHaveBeenCalledTimes(1);
  });
});
