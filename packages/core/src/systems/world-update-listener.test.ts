import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  defineComponentSystemMock,
  enhanceArmyDataMock,
  getExplorerInfoFromTileOccupierMock,
  getBlockTimestampMock,
  getStaminaManagerGetMaxStaminaMock,
  getStaminaManagerGetStaminaMock,
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
  enhanceArmyDataMock: vi.fn(async () => ({
    troopCount: 0,
    currentStamina: 0,
    onChainStamina: undefined,
    owner: { address: 0n, ownerName: "", guildName: "" },
    ownerStructureId: null,
    battleData: undefined,
  })),
  getExplorerInfoFromTileOccupierMock: vi.fn(),
  getBlockTimestampMock: vi.fn(() => ({
    currentBlockTimestamp: 100,
    currentDefaultTick: 10,
    currentArmiesTick: 10,
  })),
  getStaminaManagerGetMaxStaminaMock: vi.fn(() => 120),
  getStaminaManagerGetStaminaMock: vi.fn((troops: { stamina: { amount: bigint; updated_tick: bigint } }) => ({
    amount: troops.stamina.amount,
    updated_tick: troops.stamina.updated_tick,
  })),
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
  getExplorerInfoFromTileOccupier: getExplorerInfoFromTileOccupierMock,
  getStructureInfoFromTileOccupier: getStructureInfoFromTileOccupierMock,
}));

vi.mock("./data-enhancer", () => ({
  DataEnhancer: class {
    constructor(_mapDataStore: unknown) {}
    enhanceArmyData = enhanceArmyDataMock;
    enhanceStructureData = enhanceStructureDataMock;
    getPlayerName = getPlayerNameMock;
    updateStructureOwner = updateStructureOwnerMock;
  },
}));

vi.mock("../utils/timestamp", () => ({
  getBlockTimestamp: getBlockTimestampMock,
}));

vi.mock("../managers", () => ({
  StaminaManager: {
    getMaxStamina: getStaminaManagerGetMaxStaminaMock,
    getStamina: getStaminaManagerGetStaminaMock,
  },
}));

import { WorldUpdateListener } from "./world-update-listener";

const encodeAddressName = (value: string): bigint => BigInt(`0x${Buffer.from(value, "utf8").toString("hex")}`);

describe("WorldUpdateListener army tile bootstrap", () => {
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
    getExplorerInfoFromTileOccupierMock.mockReset();
    getBlockTimestampMock.mockReset();
    getBlockTimestampMock.mockReturnValue({
      currentBlockTimestamp: 100,
      currentDefaultTick: 10,
      currentArmiesTick: 10,
    });
    getStaminaManagerGetMaxStaminaMock.mockReset();
    getStaminaManagerGetMaxStaminaMock.mockReturnValue(120);
    getStaminaManagerGetStaminaMock.mockReset();
    getStaminaManagerGetStaminaMock.mockImplementation(
      (troops: { stamina: { amount: bigint; updated_tick: bigint } }) => ({
        amount: troops.stamina.amount,
        updated_tick: troops.stamina.updated_tick,
      }),
    );
    enhanceArmyDataMock.mockReset();
    enhanceArmyDataMock.mockResolvedValue({
      troopCount: 0,
      currentStamina: 0,
      onChainStamina: undefined,
      owner: { address: 0n, ownerName: "", guildName: "" },
      ownerStructureId: null,
      battleData: undefined,
    });
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

  it("subscribes explorer troop updates with runOnInit enabled", () => {
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

    listener.Army.onExplorerTroopsUpdate(() => {});

    expect(defineComponentSystemMock).toHaveBeenCalledTimes(1);
    const options = defineComponentSystemMock.mock.calls[0][3];
    expect(options).toMatchObject({ runOnInit: true });
  });

  it("uses live explorer troops stamina on tile bootstrap when data enhancer is stale", async () => {
    isComponentUpdateMock.mockReturnValue(true);
    tileOptToTileMock.mockReturnValue({
      occupier_type: 1,
      occupier_id: 777,
      col: 12,
      row: 34,
    });
    getExplorerInfoFromTileOccupierMock.mockReturnValue({
      troopType: "Knight",
      troopTier: "T1",
      isDaydreamsAgent: false,
    });
    getComponentValueMock.mockReturnValue({
      owner: 99,
      troops: {
        count: 500n,
        category: "Knight",
        tier: "T1",
        stamina: {
          amount: 15n,
          updated_tick: 3n,
        },
        boosts: {
          incr_damage_dealt_percent_num: 0,
          incr_damage_dealt_end_tick: 0,
          decr_damage_gotten_percent_num: 0,
          decr_damage_gotten_end_tick: 0,
          incr_stamina_regen_percent_num: 0,
          incr_stamina_regen_tick_count: 0,
          incr_explore_reward_percent_num: 0,
          incr_explore_reward_end_tick: 0,
        },
        battle_cooldown_end: 0,
      },
    });
    enhanceArmyDataMock.mockResolvedValue({
      troopCount: 0,
      currentStamina: 0,
      onChainStamina: undefined,
      owner: { address: 123n, ownerName: "Alice", guildName: "" },
      ownerStructureId: 99,
      battleData: undefined,
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
    listener.Army.onTileUpdate(callback);

    const handleUpdate = defineComponentSystemMock.mock.calls[0][2];
    await handleUpdate({ value: [{ value: "tile" }, undefined] });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 777,
        troopCount: 500,
        currentStamina: 15,
        onChainStamina: {
          amount: 15n,
          updatedTick: 3,
        },
      }),
    );
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
