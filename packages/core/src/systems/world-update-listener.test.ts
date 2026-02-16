import { beforeEach, describe, expect, it, vi } from "vitest";

const { defineComponentSystemMock, mapDataStoreRefreshMock, isComponentUpdateMock, getStructureOwnerMock } = vi.hoisted(
  () => ({
    defineComponentSystemMock: vi.fn(),
    mapDataStoreRefreshMock: vi.fn().mockResolvedValue(undefined),
    isComponentUpdateMock: vi.fn(),
    getStructureOwnerMock: vi.fn(),
  }),
);

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
    }),
  },
}));

vi.mock("./data-enhancer", () => ({
  DataEnhancer: class {
    constructor(_mapDataStore: unknown) {}

    getStructureOwner(ownerId: number) {
      return getStructureOwnerMock(ownerId);
    }
  },
}));

import { WorldUpdateListener } from "./world-update-listener";

describe("WorldUpdateListener army tile bootstrap", () => {
  beforeEach(() => {
    defineComponentSystemMock.mockClear();
    mapDataStoreRefreshMock.mockClear();
    isComponentUpdateMock.mockReset();
    isComponentUpdateMock.mockReturnValue(false);
    getStructureOwnerMock.mockReset();
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

  it("drops stale out-of-order explorer troop updates and emits only the latest", async () => {
    isComponentUpdateMock.mockReturnValue(true);

    let resolveFirstOwner: ((value: { address: bigint; ownerName: string }) => void) | undefined;
    getStructureOwnerMock.mockImplementation((ownerId: number) => {
      if (ownerId === 101) {
        return new Promise((resolve) => {
          resolveFirstOwner = resolve;
        });
      }

      return Promise.resolve({ address: 2n, ownerName: "new-owner" });
    });

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

    const callback = vi.fn();
    listener.Army.onExplorerTroopsUpdate(callback);

    const handleUpdate = defineComponentSystemMock.mock.calls[0][2];
    const olderUpdatePromise = handleUpdate({
      entity: "entity-1",
      value: [
        {
          explorer_id: 42,
          owner: 101,
          coord: { x: 1000, y: 2000 },
          troops: {
            count: 10n,
            stamina: { amount: 100n, updated_tick: 1 },
            battle_cooldown_end: 1,
          },
        },
        undefined,
      ],
    });

    const latestUpdatePromise = handleUpdate({
      entity: "entity-1",
      value: [
        {
          explorer_id: 42,
          owner: 202,
          coord: { x: 1001, y: 2001 },
          troops: {
            count: 20n,
            stamina: { amount: 200n, updated_tick: 2 },
            battle_cooldown_end: 2,
          },
        },
        undefined,
      ],
    });

    resolveFirstOwner?.({ address: 1n, ownerName: "old-owner" });

    await Promise.all([olderUpdatePromise, latestUpdatePromise]);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 42,
        hexCoords: { col: 1001, row: 2001 },
        ownerAddress: 2n,
      }),
    );
  });
});
