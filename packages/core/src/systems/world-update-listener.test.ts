import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  defineComponentSystemMock,
  isComponentUpdateMock,
  mapDataStoreRefreshMock,
  mapDataStoreGetStructureByIdMock,
  mapDataStoreUpdateStructureGuardsMock,
  mapDataStoreGetEntityIdFromEntityMock,
  getStructureOwnerMock,
  getPlayerNameMock,
  updateStructureOwnerMock,
} = vi.hoisted(() => ({
  defineComponentSystemMock: vi.fn(),
  isComponentUpdateMock: vi.fn(),
  mapDataStoreRefreshMock: vi.fn().mockResolvedValue(undefined),
  mapDataStoreGetStructureByIdMock: vi.fn(),
  mapDataStoreUpdateStructureGuardsMock: vi.fn(),
  mapDataStoreGetEntityIdFromEntityMock: vi.fn(),
  getStructureOwnerMock: vi.fn(),
  getPlayerNameMock: vi.fn(),
  updateStructureOwnerMock: vi.fn(),
}));

vi.mock("@dojoengine/recs", async () => {
  const actual = await vi.importActual<typeof import("@dojoengine/recs")>("@dojoengine/recs");
  return {
    ...actual,
    defineComponentSystem: defineComponentSystemMock,
    isComponentUpdate: isComponentUpdateMock,
  };
});

vi.mock("../stores/map-data-store", () => ({
  TROOP_TIERS: { T1: 1, T2: 2, T3: 3 },
  MapDataStore: {
    getInstance: () => ({
      refresh: mapDataStoreRefreshMock,
      getStructureById: mapDataStoreGetStructureByIdMock,
      updateStructureGuards: mapDataStoreUpdateStructureGuardsMock,
      getEntityIdFromEntity: mapDataStoreGetEntityIdFromEntityMock,
      destroy: vi.fn(),
    }),
  },
}));

vi.mock("./data-enhancer", () => ({
  DataEnhancer: class {
    constructor(_mapDataStore: unknown) {}
    getStructureOwner = getStructureOwnerMock;
    getPlayerName = getPlayerNameMock;
    updateStructureOwner = updateStructureOwnerMock;
  },
}));

import { WorldUpdateListener } from "./world-update-listener";

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const makeDeferred = <T = unknown>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe("WorldUpdateListener army tile bootstrap", () => {
  beforeEach(() => {
    defineComponentSystemMock.mockClear();
    isComponentUpdateMock.mockReset();
    mapDataStoreRefreshMock.mockClear();
    mapDataStoreGetStructureByIdMock.mockReset();
    mapDataStoreUpdateStructureGuardsMock.mockReset();
    mapDataStoreGetEntityIdFromEntityMock.mockReset();
    getStructureOwnerMock.mockReset();
    getPlayerNameMock.mockReset();
    updateStructureOwnerMock.mockReset();

    isComponentUpdateMock.mockImplementation((update: { __component?: unknown }, component: unknown) => {
      return update.__component === component;
    });
  });

  it("subscribes army tile updates with runOnInit enabled", () => {
    const listener = new WorldUpdateListener(
      {
        network: { world: {} },
        components: {
          TileOpt: {},
          ExplorerTroops: {},
        },
      } as any,
      {} as any,
    );

    listener.Army.onTileUpdate(() => {});

    expect(defineComponentSystemMock).toHaveBeenCalledTimes(1);
    const options = defineComponentSystemMock.mock.calls[0][3];
    expect(options).toMatchObject({ runOnInit: true });
  });

  it("drops stale explorer troops updates when async owner lookup resolves out of order", async () => {
    const ownerA = makeDeferred<{ address: bigint; ownerName: string }>();
    const ownerB = makeDeferred<{ address: bigint; ownerName: string }>();

    getStructureOwnerMock.mockImplementation((ownerStructureId: number) => {
      if (ownerStructureId === 100) return ownerA.promise;
      if (ownerStructureId === 200) return ownerB.promise;
      return Promise.resolve({ address: 0n, ownerName: "" });
    });

    const setup = {
      network: { world: {} },
      components: {
        ExplorerTroops: { id: "ExplorerTroops" },
      },
    } as any;

    const listener = new WorldUpdateListener(setup, {} as any);
    const callback = vi.fn();
    listener.Army.onExplorerTroopsUpdate(callback);

    const handleUpdate = defineComponentSystemMock.mock.calls[0][2] as (update: unknown) => Promise<void>;

    const olderUpdate = handleUpdate({
      __component: setup.components.ExplorerTroops,
      entity: "entity-9",
      value: [
        {
          explorer_id: 9,
          owner: 100,
          coord: { x: 11, y: 12 },
          troops: {
            count: 1200,
            stamina: { amount: 5n, updated_tick: 10 },
            battle_cooldown_end: 0,
          },
        },
        null,
      ],
    });

    const newerUpdate = handleUpdate({
      __component: setup.components.ExplorerTroops,
      entity: "entity-9",
      value: [
        {
          explorer_id: 9,
          owner: 200,
          coord: { x: 21, y: 22 },
          troops: {
            count: 800,
            stamina: { amount: 8n, updated_tick: 11 },
            battle_cooldown_end: 0,
          },
        },
        null,
      ],
    });

    ownerB.resolve({ address: 0xbbbfn, ownerName: "new-owner" });
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(0);

    ownerA.resolve({ address: 0xaaaan, ownerName: "old-owner" });
    await Promise.all([olderUpdate, newerUpdate]);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entityId: 9,
        ownerAddress: 0xbbbfn,
        ownerName: "new-owner",
        ownerStructureId: 200,
        hexCoords: { col: 21, row: 22 },
      }),
    );
  });

  it("drops stale structure updates when async owner-name lookup resolves out of order", async () => {
    const ownerNameA = makeDeferred<string>();
    const ownerNameB = makeDeferred<string>();

    getPlayerNameMock.mockImplementation((ownerAddress: string) => {
      if (ownerAddress === "123") return ownerNameA.promise;
      if (ownerAddress === "456") return ownerNameB.promise;
      return Promise.resolve("");
    });

    const setup = {
      network: { world: {} },
      components: {
        Structure: { id: "Structure" },
      },
    } as any;

    const listener = new WorldUpdateListener(setup, {} as any);
    const callback = vi.fn();
    listener.Structure.onStructureUpdate(callback);

    const handleUpdate = defineComponentSystemMock.mock.calls[0][2] as (update: unknown) => Promise<void>;

    const olderUpdate = handleUpdate({
      __component: setup.components.Structure,
      entity: "structure-3",
      value: [
        {
          entity_id: 3,
          owner: 123n,
          base: { coord_x: 10, coord_y: 10 },
          troop_guards: {
            alpha: { category: 1, tier: "T1", count: 1000, stamina: { amount: 4 }, battle_cooldown_end: 0 },
            bravo: null,
            charlie: null,
            delta: null,
          },
        },
        null,
      ],
    });

    const newerUpdate = handleUpdate({
      __component: setup.components.Structure,
      entity: "structure-3",
      value: [
        {
          entity_id: 3,
          owner: 456n,
          base: { coord_x: 15, coord_y: 16 },
          troop_guards: {
            alpha: { category: 1, tier: "T1", count: 2000, stamina: { amount: 5 }, battle_cooldown_end: 0 },
            bravo: null,
            charlie: null,
            delta: null,
          },
        },
        null,
      ],
    });

    ownerNameB.resolve("new-structure-owner");
    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(0);

    ownerNameA.resolve("old-structure-owner");
    await Promise.all([olderUpdate, newerUpdate]);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 3,
        hexCoords: { col: 15, row: 16 },
        owner: expect.objectContaining({
          address: 456n,
          ownerName: "new-structure-owner",
        }),
      }),
    );
  });
});
