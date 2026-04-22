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
    // Dojo 1.8.x: world_addresses is the 2nd positional arg before the callback.
    onEntityUpdated: vi.fn(async (_clause, _worldAddresses, callback: EntityUpdatedCallback) => {
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

  it("resolves ready as soon as subscriptions are registered (deltas-only semantics)", async () => {
    // Dojo 1.8.x: onEntityUpdated streams deltas only, so the ready promise can no
    // longer be gated on receiving the first subscription callback — initial state
    // arrives via the separate getEntities calls in initialSync. Readiness resolves
    // immediately after subscription setup completes.
    const harness = createSyncHarness();
    const subscription = await syncEntitiesDebounced(harness.client as any, harness.setup as any, null, false);

    await subscription.ready;
  });

  it("debounces entity updates into a single setEntities batch", async () => {
    vi.useFakeTimers();
    const harness = createSyncHarness();
    await syncEntitiesDebounced(harness.client as any, harness.setup as any, null, false);

    harness.emitEntityUpdate({
      hashed_keys: "entity-1",
      models: {
        "s1_eternum-Structure": { entity_id: 1 },
      },
    });

    await vi.advanceTimersByTimeAsync(199);
    expect(setEntitiesMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

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

  it("tears down both subscriptions when canceled", async () => {
    const harness = createSyncHarness();
    const subscription = await syncEntitiesDebounced(harness.client as any, harness.setup as any, null, false);

    subscription.cancel();

    expect(harness.cancelEntitySubscription).toHaveBeenCalledTimes(1);
    expect(harness.cancelEventSubscription).toHaveBeenCalledTimes(1);
  });
});
