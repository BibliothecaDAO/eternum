import { beforeEach, describe, expect, it, vi } from "vitest";

const { defineComponentSystemMock, mapDataStoreRefreshMock } = vi.hoisted(() => ({
  defineComponentSystemMock: vi.fn(),
  mapDataStoreRefreshMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@dojoengine/recs", async () => {
  const actual = await vi.importActual<typeof import("@dojoengine/recs")>("@dojoengine/recs");
  return {
    ...actual,
    defineComponentSystem: defineComponentSystemMock,
    isComponentUpdate: () => false,
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
  },
}));

import { WorldUpdateListener } from "./world-update-listener";

describe("WorldUpdateListener army tile bootstrap", () => {
  beforeEach(() => {
    defineComponentSystemMock.mockClear();
    mapDataStoreRefreshMock.mockClear();
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
});
