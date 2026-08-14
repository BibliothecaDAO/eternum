import { beforeEach, describe, expect, it, vi } from "vitest";
import { TileOccupier } from "@bibliothecadao/types";

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
  getStructureInfoFromTileOccupier: getStructureInfoFromTileOccupierMock,
}));

import { WorldUpdateListener } from "./world-update-listener";

const encodeAddressName = (value: string): bigint => BigInt(`0x${Buffer.from(value, "utf8").toString("hex")}`);

describe("WorldUpdateListener", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
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
  });

  it("subscribes structure tile updates with runOnInit enabled", () => {
    const listener = new WorldUpdateListener(
      {
        network: { world: {} },
        components: {
          TileOpt: {},
          Hyperstructure: {},
          Structure: {},
        },
      } as any,
      {} as any,
    );

    listener.Structure.onTileUpdate(() => {});

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

  it("does not keep an async SQL data enhancer", () => {
    const listener = new WorldUpdateListener(
      {
        network: { world: {} },
        components: {},
      } as any,
      {} as any,
    );

    expect((listener as any).dataEnhancer).toBeUndefined();
  });

  it("does not expose a direct TileOpt structure hydration helper", async () => {
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

    expect((listener as any).resolveStructureTileUpdateFromTileOpt).toBeUndefined();
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
    getComponentValueMock.mockImplementation((component) => {
      if (component === structureComponents.Structure) {
        return {
          owner: 123n,
          troop_guards: null,
          base: {
            category: 0,
          },
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

  it("completes a pending tile update when a newer structure update arrives for the same entity", async () => {
    // Regression pin (live hyperstructure-creation bug): the Tile stream is the only
    // live path that places a structure mesh. A Structure component update landing
    // while the tile update is still resolving must NOT cancel it — the mesh add
    // would be dropped and the new structure stays invisible until rehydration.
    // Owner freshness is preserved because the tile resolver reads the Structure
    // component live from RECS at execution time.
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
    getComponentValueMock.mockImplementation((component) => {
      if (component === structureComponents.Structure) {
        return {
          entity_id: 921,
          owner: 123n,
          troop_guards: null,
          base: {
            category: 0,
          },
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

    await Promise.all([pendingTileUpdate, pendingStructureUpdate]);

    expect(tileCallback).toHaveBeenCalledTimes(1);
    expect(tileCallback.mock.calls[0][0]).toMatchObject({
      entityId: 921,
      hexCoords: { col: 10, row: 15 },
      owner: {
        address: 123n,
        ownerName: "Alice",
        guildName: "",
      },
    });
    expect(structureCallback).toHaveBeenCalledTimes(1);
    expect(structureCallback.mock.calls[0][0].owner).toEqual({
      address: 123n,
      ownerName: "Alice",
      guildName: "",
    });
  });

  it("emits repeated structure tile updates without async supersession", async () => {
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

    const listener = new WorldUpdateListener(
      {
        network: { world: {} },
        components: structureComponents,
      } as any,
      {} as any,
    );

    const tileCallback = vi.fn();
    listener.Structure.onTileUpdate(tileCallback);

    const tileHandleUpdate = defineComponentSystemMock.mock.calls[0][2];

    const staleTileUpdate = tileHandleUpdate({
      value: [{}, undefined],
      entity: "0x123",
    });
    const freshTileUpdate = tileHandleUpdate({
      value: [{}, undefined],
      entity: "0x123",
    });

    await Promise.all([staleTileUpdate, freshTileUpdate]);

    expect(tileCallback).toHaveBeenCalledTimes(2);
  });

  it("skips reserved hyperstructure placeholders in the real structure tile stream", async () => {
    isComponentUpdateMock.mockReturnValue(true);
    tileOptToTileMock.mockImplementation((value) => value);
    getStructureInfoFromTileOccupierMock.mockReturnValue({
      type: 2,
      stage: 0,
      level: 1,
      hasWonder: false,
      reserved: true,
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
      value: [
        {
          occupier_type: TileOccupier.ReservedHyperstructure,
          occupier_id: 0,
          col: 10,
          row: 15,
        },
        undefined,
      ],
      entity: "0x123",
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("emits reserved hyperstructure tile updates from current and previous tile state", async () => {
    isComponentUpdateMock.mockReturnValue(true);
    tileOptToTileMock.mockImplementation((value) => value);

    const listener = new WorldUpdateListener(
      {
        network: { world: {} },
        components: {
          TileOpt: {},
        },
      } as any,
      {} as any,
    );

    const callback = vi.fn();
    listener.ReservedHyperstructure.onTileUpdate(callback);

    const handleUpdate = defineComponentSystemMock.mock.calls[0][2];

    await handleUpdate({
      value: [
        {
          occupier_type: TileOccupier.ReservedHyperstructure,
          occupier_id: 0,
          col: 12,
          row: 34,
        },
        undefined,
      ],
    });

    await handleUpdate({
      value: [
        undefined,
        {
          occupier_type: TileOccupier.ReservedHyperstructure,
          occupier_id: 0,
          col: 12,
          row: 34,
        },
      ],
    });

    expect(callback).toHaveBeenNthCalledWith(1, {
      hexCoords: { col: 12, row: 34 },
    });
    expect(callback).toHaveBeenNthCalledWith(2, {
      hexCoords: { col: 12, row: 34 },
      removed: true,
    });
  });
});

const structureComponents = {
  TileOpt: {},
  Hyperstructure: {},
  Structure: {},
  AddressName: {},
};
