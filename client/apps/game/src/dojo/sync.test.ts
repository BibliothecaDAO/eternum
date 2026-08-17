// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const setEntitiesMock = vi.hoisted(() => vi.fn());

const envMock = vi.hoisted(() => ({
  env: {
    VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS: 8_000,
    VITE_PUBLIC_TORII_SNAPSHOT_PAGE_TIMEOUT_MS: 15_000,
    VITE_PUBLIC_TORII_EVENT_REPLAY_PAGE_TIMEOUT_MS: 10_000,
    VITE_PUBLIC_TORII_PAGE_RETRY_COUNT: 2,
  },
}));

vi.mock("@dojoengine/state", () => ({
  setEntities: setEntitiesMock,
}));

vi.mock("@bibliothecadao/eternum", () => ({
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

vi.mock("./queries", () => ({
  getAddressNamesFromTorii: vi.fn(),
  getBankStructuresFromTorii: vi.fn(),
  getConfigFromTorii: vi.fn(),
  getGuildsFromTorii: vi.fn(),
}));

vi.mock("../../env", () => envMock);

vi.mock("./connection-health-monitor", () => ({
  requestConnectionRecovery: vi.fn(),
}));

vi.mock("./sync-initial-selection", () => ({
  resolveInitialStructureSelection: vi.fn(() => ({ selectedStructure: null, spectator: false })),
}));

vi.mock("./torii-model-clause", () => ({
  buildModelKeysClause: vi.fn((models: Array<{ model: string }>) => ({
    mocked: "model-stream-clause",
    models: models.map(({ model }) => model),
  })),
}));

import { cancelGameSyncWriter, initialSync, recoverGameSyncSession } from "./sync";

type ToriiEntityStub = {
  hashed_keys: string;
  models: Record<string, unknown>;
};

type EntityUpdatedCallback = (entity: ToriiEntityStub) => void;

function createSyncHarness() {
  const cancelEntitySubscription = vi.fn();
  const cancelEventSubscription = vi.fn();
  const entitySubscription = { cancel: cancelEntitySubscription };
  const eventSubscription = { cancel: cancelEventSubscription };

  const client = {
    onEntityUpdated: vi.fn(async (_clause, _callback: EntityUpdatedCallback) => entitySubscription),
    onEventMessageUpdated: vi.fn(async () => eventSubscription),
    getEntities: vi.fn(
      async (_input: unknown): Promise<{ items: ToriiEntityStub[]; next_cursor?: string }> => ({
        items: [],
        next_cursor: undefined,
      }),
    ),
    getEventMessages: vi.fn(async () => ({ items: [], next_cursor: undefined })),
  };

  const createEmptyComponent = () => ({
    entities: function* () {},
    update$: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
  });
  const structureComponent = createEmptyComponent();
  const tileOptComponent = createEmptyComponent();
  const explorerTroopsComponent = createEmptyComponent();

  const setup = {
    components: {
      Structure: structureComponent,
      TileOpt: tileOptComponent,
      ExplorerTroops: explorerTroopsComponent,
    },
    network: {
      toriiClient: client,
      contractComponents: {
        Structure: structureComponent,
        TileOpt: tileOptComponent,
        ExplorerTroops: explorerTroopsComponent,
      },
      world: {
        components: {},
        deleteEntity: vi.fn(),
      },
    },
  };

  return {
    cancelEntitySubscription,
    cancelEventSubscription,
    client,
    setup,
  };
}

function createInitialSyncState() {
  return {
    structureEntityId: 0,
    setStructureEntityId: vi.fn(),
  };
}

describe("initialSync global streams", () => {
  afterEach(() => {
    cancelGameSyncWriter();
  });

  it("uses one static game-wide entity stream and paginated snapshot", async () => {
    const harness = createSyncHarness();

    await initialSync(harness.setup as any, createInitialSyncState() as any, vi.fn(), {
      logging: false,
      reportProgress: false,
    });

    expect(harness.client.onEntityUpdated).toHaveBeenCalledTimes(1);
    expect(harness.client.onEntityUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        models: expect.arrayContaining([
          "s1_eternum-AddressName",
          "s1_eternum-Guild",
          "s1_eternum-TileOpt",
          "s1_eternum-Structure",
          "s1_eternum-Resource",
        ]),
      }),
      expect.any(Function),
    );
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
    expect(harness.client.getEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        models: expect.arrayContaining([
          "s1_eternum-Guild",
          "s1_eternum-TileOpt",
          "s1_eternum-Structure",
          "s1_eternum-Resource",
        ]),
        pagination: expect.objectContaining({ limit: 500 }),
      }),
    );
  });

  it("reruns the same paginated game-wide recovery on reconnect", async () => {
    const harness = createSyncHarness();
    harness.client.getEntities
      .mockResolvedValueOnce({ items: [], next_cursor: "page-2" })
      .mockResolvedValueOnce({ items: [], next_cursor: undefined })
      .mockResolvedValueOnce({ items: [], next_cursor: undefined });

    await initialSync(harness.setup as any, createInitialSyncState() as any, vi.fn(), {
      logging: false,
      reportProgress: false,
    });
    await recoverGameSyncSession();

    expect(harness.client.getEntities).toHaveBeenCalledTimes(3);
    expect((harness.client.getEntities.mock.calls[1]?.[0] as any).pagination.cursor).toBe("page-2");
    expect(harness.client.onEntityUpdated).toHaveBeenCalledTimes(2);
    expect(harness.cancelEntitySubscription).toHaveBeenCalledOnce();
  });

  it("cancels the single global stream pair after initial sync", async () => {
    const harness = createSyncHarness();

    await initialSync(harness.setup as any, createInitialSyncState() as any, vi.fn(), {
      logging: false,
      reportProgress: false,
    });

    cancelGameSyncWriter();

    expect(harness.cancelEntitySubscription).toHaveBeenCalledTimes(1);
    expect(harness.cancelEventSubscription).toHaveBeenCalledTimes(1);
  });
});
