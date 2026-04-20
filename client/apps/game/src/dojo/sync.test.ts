// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const { setEntitiesMock } = vi.hoisted(() => ({
  setEntitiesMock: vi.fn(),
}));

vi.mock("@dojoengine/state", () => ({
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
    getState: vi.fn(() => ({ recordGlobalUpdate: vi.fn() })),
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
  buildModelKeysClause: vi.fn(() => ({ mocked: "global-stream-clause" })),
}));

import { syncEntitiesDebounced } from "./sync";

type ToriiEntityStub = {
  hashed_keys: string;
  models: Record<string, unknown>;
};

type EntityUpdatedCallback = (entity: ToriiEntityStub) => void;

function createSyncHarness() {
  let onEntityUpdated: EntityUpdatedCallback | null = null;
  const cancelEntitySubscription = vi.fn();
  const cancelEventSubscription = vi.fn();

  const client = {
    onEntityUpdated: vi.fn(async (_clause, callback: EntityUpdatedCallback) => {
      onEntityUpdated = callback;
      return { cancel: cancelEntitySubscription };
    }),
    onEventMessageUpdated: vi.fn(async () => ({ cancel: cancelEventSubscription })),
  };

  const setup = {
    network: {
      world: {
        components: {},
        deleteEntity: vi.fn(),
      },
    },
  };

  const emitEntityUpdate = (entity: ToriiEntityStub) => {
    if (!onEntityUpdated) {
      throw new Error("entity subscription was not created");
    }
    onEntityUpdated(entity);
  };

  return {
    cancelEntitySubscription,
    cancelEventSubscription,
    client,
    emitEntityUpdate,
    setup,
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
});
