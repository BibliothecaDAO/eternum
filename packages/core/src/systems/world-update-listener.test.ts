import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  defineComponentSystemMock,
  mapDataStoreRefreshMock,
  mapDataStoreGetStructureByIdMock,
  mapDataStoreUpdateStructureGuardsMock,
  isComponentUpdateMock,
  getComponentValueMock,
  tileOptToTileMock,
  getStructureTypeNameMock,
  getIsBlitzMock,
  getStructureInfoFromTileOccupierMock,
  enhanceStructureDataMock,
  getPlayerNameMock,
  updateStructureOwnerMock,
} = vi.hoisted(() => ({
  defineComponentSystemMock: vi.fn(),
  mapDataStoreRefreshMock: vi.fn().mockResolvedValue(undefined),
  mapDataStoreGetStructureByIdMock: vi.fn(),
  mapDataStoreUpdateStructureGuardsMock: vi.fn(),
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
  getPlayerNameMock: vi.fn(async () => ""),
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
      getStructureById: mapDataStoreGetStructureByIdMock,
      updateStructureGuards: mapDataStoreUpdateStructureGuardsMock,
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
    getPlayerName = getPlayerNameMock;
    updateStructureOwner = updateStructureOwnerMock;
  },
}));

import { WorldUpdateListener } from "./world-update-listener";

const encodeAddressName = (value: string): bigint => BigInt(`0x${Buffer.from(value, "utf8").toString("hex")}`);

describe("WorldUpdateListener army tile bootstrap", () => {
  beforeEach(() => {
    defineComponentSystemMock.mockClear();
    mapDataStoreRefreshMock.mockClear();
    mapDataStoreGetStructureByIdMock.mockReset();
    mapDataStoreUpdateStructureGuardsMock.mockReset();
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
    getPlayerNameMock.mockReset();
    getPlayerNameMock.mockResolvedValue("");
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

  it("re-resolves a non-zero owner when cached data still says The Vanguard", async () => {
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
      owner: { address: 123n, ownerName: "The Vanguard", guildName: "" },
      guardArmies: [],
      activeProductions: [],
      battleData: undefined,
      structureName: "Realm of Testing",
    });
    getComponentValueMock.mockImplementation((component) => {
      if (component === structureComponents.Structure) {
        return {
          owner: 123n,
          troop_guards: null,
        };
      }

      if (component === structureComponents.AddressName) {
        return {
          name: encodeAddressName("Alice"),
        };
      }

      return undefined;
    });

    const listener = new WorldUpdateListener(
      {
        network: { world: {} },
        components: structureComponents,
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
    expect(callback.mock.calls[0][0].owner).toEqual({
      address: 123n,
      ownerName: "Alice",
      guildName: "",
    });
  });

  it("drops a stale tile hydration result when a newer structure update arrives", async () => {
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
    getPlayerNameMock.mockResolvedValue("Alice");

    let resolveTileUpdate!: (value: {
      owner: { address: bigint; ownerName: string; guildName: string };
      guardArmies: never[];
      activeProductions: never[];
      battleData: undefined;
    }) => void;
    enhanceStructureDataMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTileUpdate = resolve;
        }),
    );

    const listener = new WorldUpdateListener(
      {
        network: { world: {} },
        components: structureComponents,
      } as any,
      {} as any,
    );

    const tileCallback = vi.fn();
    const structureCallback = vi.fn();
    listener.Structure.onTileUpdate(tileCallback);
    listener.Structure.onStructureUpdate(structureCallback);

    const tileHandleUpdate = defineComponentSystemMock.mock.calls[0][2];
    const structureHandleUpdate = defineComponentSystemMock.mock.calls[1][2];

    const pendingTileUpdate = tileHandleUpdate({
      value: [{}, undefined],
      entity: "0x123",
    });

    const pendingStructureUpdate = structureHandleUpdate({
      value: [
        {
          entity_id: 921,
          owner: 123n,
          troop_guards: null,
          base: { coord_x: 10, coord_y: 15 },
        },
        undefined,
      ],
      entity: "0x123",
    });

    resolveTileUpdate({
      owner: { address: 0n, ownerName: "The Vanguard", guildName: "" },
      guardArmies: [],
      activeProductions: [],
      battleData: undefined,
    });

    await Promise.all([pendingTileUpdate, pendingStructureUpdate]);

    expect(tileCallback).not.toHaveBeenCalled();
    expect(structureCallback).toHaveBeenCalledTimes(1);
    expect(structureCallback.mock.calls[0][0].owner).toEqual({
      address: 123n,
      ownerName: "Alice",
      guildName: "",
    });
  });
});

const structureComponents = {
  TileOpt: {},
  Hyperstructure: {},
  Structure: {},
  AddressName: {},
};
