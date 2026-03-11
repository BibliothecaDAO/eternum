import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  defineComponentSystemMock,
  mapDataStoreRefreshMock,
  isComponentUpdateMock,
  getComponentValueMock,
  tileOptToTileMock,
  getStructureTypeNameMock,
  getIsBlitzMock,
  getStructureInfoFromTileOccupierMock,
  enhanceStructureDataMock,
  updateStructureOwnerMock,
} = vi.hoisted(() => ({
  defineComponentSystemMock: vi.fn(),
  mapDataStoreRefreshMock: vi.fn().mockResolvedValue(undefined),
  isComponentUpdateMock: vi.fn(() => false),
  getComponentValueMock: vi.fn(() => undefined),
  tileOptToTileMock: vi.fn(),
  getStructureTypeNameMock: vi.fn(() => "Essence Rift"),
  getIsBlitzMock: vi.fn(() => true),
  getStructureInfoFromTileOccupierMock: vi.fn(),
  enhanceStructureDataMock: vi.fn(async () => ({
    owner: { address: 0n, ownerName: "", guildName: "" },
    guardArmies: [],
    activeProductions: [],
    battleData: undefined,
  })),
  updateStructureOwnerMock: vi.fn(),
}));

vi.mock("@dojoengine/recs", async () => {
  const actual = await vi.importActual<typeof import("@dojoengine/recs")>("@dojoengine/recs");
  return {
    ...actual,
    defineComponentSystem: defineComponentSystemMock,
    isComponentUpdate: isComponentUpdateMock,
    getComponentValue: getComponentValueMock,
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

vi.mock("../utils", async () => {
  const actual = await vi.importActual<typeof import("../utils")>("../utils");
  return {
    ...actual,
    divideByPrecision: vi.fn((value: number) => value),
    tileOptToTile: tileOptToTileMock,
    unpackBuildingCounts: vi.fn(() => []),
    getIsBlitz: getIsBlitzMock,
    getStructureTypeName: getStructureTypeNameMock,
  };
});

vi.mock("./utils", () => ({
  getExplorerInfoFromTileOccupier: vi.fn(),
  getStructureInfoFromTileOccupier: getStructureInfoFromTileOccupierMock,
}));

vi.mock("./data-enhancer", () => ({
  DataEnhancer: class {
    constructor(_mapDataStore: unknown) {}
    enhanceStructureData = enhanceStructureDataMock;
    updateStructureOwner = updateStructureOwnerMock;
  },
}));

import { WorldUpdateListener } from "./world-update-listener";

describe("WorldUpdateListener army tile bootstrap", () => {
  beforeEach(() => {
    defineComponentSystemMock.mockClear();
    mapDataStoreRefreshMock.mockClear();
    isComponentUpdateMock.mockReset();
    isComponentUpdateMock.mockReturnValue(false);
    getComponentValueMock.mockReset();
    getComponentValueMock.mockReturnValue(undefined);
    tileOptToTileMock.mockReset();
    getStructureTypeNameMock.mockReset();
    getStructureTypeNameMock.mockReturnValue("Essence Rift");
    getIsBlitzMock.mockReset();
    getIsBlitzMock.mockReturnValue(true);
    getStructureInfoFromTileOccupierMock.mockReset();
    enhanceStructureDataMock.mockClear();
    updateStructureOwnerMock.mockClear();
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

  it("falls back to type-based structure name when Structure component is unavailable", async () => {
    isComponentUpdateMock.mockReturnValue(true);
    tileOptToTileMock.mockReturnValue({
      occupier_type: 1,
      occupier_id: 921,
      col: 10,
      row: 15,
    });
    getStructureInfoFromTileOccupierMock.mockReturnValue({
      type: 4,
      stage: 0,
      level: 1,
      hasWonder: false,
    });
    enhanceStructureDataMock.mockResolvedValue({
      owner: { address: 123n, ownerName: "", guildName: "" },
      guardArmies: [],
      activeProductions: [],
      battleData: undefined,
    });

    const listener = new WorldUpdateListener(
      {
        network: { world: {} },
        components: {
          TileOpt: {},
          Hyperstructure: {},
          Structure: {},
          AddressName: {},
        },
      } as any,
      {} as any,
    );

    const callback = vi.fn();
    listener.Structure.onTileUpdate(callback);

    const handleUpdate = defineComponentSystemMock.mock.calls[0][2];
    await handleUpdate({
      value: [{}, undefined],
      entity: "0x123",
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].structureName).toBe("Essence Rift 921");
  });

  it("uses enhanced structure name when Structure component is unavailable", async () => {
    isComponentUpdateMock.mockReturnValue(true);
    tileOptToTileMock.mockReturnValue({
      occupier_type: 1,
      occupier_id: 921,
      col: 10,
      row: 15,
    });
    getStructureInfoFromTileOccupierMock.mockReturnValue({
      type: 4,
      stage: 0,
      level: 1,
      hasWonder: false,
    });
    enhanceStructureDataMock.mockResolvedValue({
      owner: { address: 123n, ownerName: "", guildName: "" },
      guardArmies: [],
      activeProductions: [],
      battleData: undefined,
      structureName: "Realm of Testing",
    });

    const listener = new WorldUpdateListener(
      {
        network: { world: {} },
        components: {
          TileOpt: {},
          Hyperstructure: {},
          Structure: {},
          AddressName: {},
        },
      } as any,
      {} as any,
    );

    const callback = vi.fn();
    listener.Structure.onTileUpdate(callback);

    const handleUpdate = defineComponentSystemMock.mock.calls[0][2];
    await handleUpdate({
      value: [{}, undefined],
      entity: "0x123",
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].structureName).toBe("Realm of Testing");
  });
});
