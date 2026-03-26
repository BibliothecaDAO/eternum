import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  defineComponentSystemMock,
  mapDataStoreRefreshMock,
  isComponentUpdateMock,
  getComponentValueMock,
  tileOptToTileMock,
  getExplorerInfoFromTileOccupierMock,
  getStructureTypeNameMock,
  getIsBlitzMock,
  getStructureInfoFromTileOccupierMock,
  enhanceArmyDataMock,
  enhanceStructureDataMock,
  updateStructureOwnerMock,
  getBlockTimestampMock,
  staminaGetMaxStaminaMock,
  staminaGetStaminaMock,
} = vi.hoisted(() => ({
  defineComponentSystemMock: vi.fn(),
  mapDataStoreRefreshMock: vi.fn().mockResolvedValue(undefined),
  isComponentUpdateMock: vi.fn(() => false),
  getComponentValueMock: vi.fn(() => undefined),
  tileOptToTileMock: vi.fn(),
  getExplorerInfoFromTileOccupierMock: vi.fn(),
  getStructureTypeNameMock: vi.fn(() => "Essence Rift"),
  getIsBlitzMock: vi.fn(() => true),
  getStructureInfoFromTileOccupierMock: vi.fn(),
  enhanceArmyDataMock: vi.fn(async () => ({
    troopCount: 5,
    currentStamina: 11,
    onChainStamina: { amount: 11n, updatedTick: 3 },
    owner: { address: 0n, ownerName: "", guildName: "" },
    ownerStructureId: 44,
    battleData: undefined,
  })),
  enhanceStructureDataMock: vi.fn(async () => ({
    owner: { address: 0n, ownerName: "", guildName: "" },
    guardArmies: [],
    activeProductions: [],
    battleData: undefined,
  })),
  updateStructureOwnerMock: vi.fn(),
  getBlockTimestampMock: vi.fn(() => ({
    currentBlockTimestamp: 0,
    currentDefaultTick: 0,
    currentArmiesTick: 12,
  })),
  staminaGetMaxStaminaMock: vi.fn(() => 100),
  staminaGetStaminaMock: vi.fn((troops) => troops.stamina),
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
  getExplorerInfoFromTileOccupier: getExplorerInfoFromTileOccupierMock,
  getStructureInfoFromTileOccupier: getStructureInfoFromTileOccupierMock,
}));

vi.mock("./data-enhancer", () => ({
  DataEnhancer: class {
    constructor(_mapDataStore: unknown) {}
    enhanceArmyData = enhanceArmyDataMock;
    enhanceStructureData = enhanceStructureDataMock;
    updateStructureOwner = updateStructureOwnerMock;
  },
}));

vi.mock("../utils/timestamp", () => ({
  getBlockTimestamp: getBlockTimestampMock,
}));

vi.mock("../managers", () => ({
  StaminaManager: {
    getMaxStamina: staminaGetMaxStaminaMock,
    getStamina: staminaGetStaminaMock,
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
    getExplorerInfoFromTileOccupierMock.mockReset();
    getStructureTypeNameMock.mockReset();
    getStructureTypeNameMock.mockReturnValue("Essence Rift");
    getIsBlitzMock.mockReset();
    getIsBlitzMock.mockReturnValue(true);
    getStructureInfoFromTileOccupierMock.mockReset();
    enhanceArmyDataMock.mockClear();
    enhanceStructureDataMock.mockClear();
    updateStructureOwnerMock.mockClear();
    getBlockTimestampMock.mockReset();
    getBlockTimestampMock.mockReturnValue({
      currentBlockTimestamp: 0,
      currentDefaultTick: 0,
      currentArmiesTick: 12,
    });
    staminaGetMaxStaminaMock.mockReset();
    staminaGetMaxStaminaMock.mockReturnValue(100);
    staminaGetStaminaMock.mockReset();
    staminaGetStaminaMock.mockImplementation((troops) => troops.stamina);
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

  it("prefers live explorer troop state over stale enhanced army data on tile updates", async () => {
    isComponentUpdateMock.mockReturnValue(true);
    tileOptToTileMock.mockReturnValue({
      occupier_type: 7,
      occupier_id: 921,
      col: 10,
      row: 15,
    });
    getExplorerInfoFromTileOccupierMock.mockReturnValue({
      troopType: 3,
      troopTier: 2,
      isDaydreamsAgent: false,
    });
    enhanceArmyDataMock.mockResolvedValue({
      troopCount: 5,
      currentStamina: 11,
      onChainStamina: { amount: 11n, updatedTick: 3 },
      owner: { address: 123n, ownerName: "Stale SQL Owner", guildName: "" },
      ownerStructureId: 44,
      battleData: undefined,
    });
    getComponentValueMock.mockImplementation((component) => {
      if (component && component.kind === "ExplorerTroops") {
        return {
          owner: 77,
          troops: {
            count: 99n,
            stamina: {
              amount: 55n,
              updated_tick: 12n,
            },
            battle_cooldown_end: 0,
            boosts: {
              incr_stamina_regen_percent_num: 0,
              incr_stamina_regen_tick_count: 0,
              incr_explore_reward_percent_num: 0,
              incr_explore_reward_end_tick: 0,
              incr_damage_dealt_percent_num: 0,
              incr_damage_dealt_end_tick: 0,
              decr_damage_gotten_percent_num: 0,
              decr_damage_gotten_end_tick: 0,
            },
          },
        };
      }
      return undefined;
    });

    const listener = new WorldUpdateListener(
      {
        network: { world: {} },
        components: {
          TileOpt: { kind: "TileOpt" },
          ExplorerTroops: { kind: "ExplorerTroops" },
        },
      } as any,
      {} as any,
    );

    const callback = vi.fn();
    listener.Army.onTileUpdate(callback);

    const handleUpdate = defineComponentSystemMock.mock.calls[0][2];
    await handleUpdate({
      value: [{}, undefined],
      entity: "0x123",
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toMatchObject({
      entityId: 921,
      troopCount: 99,
      currentStamina: 55,
      onChainStamina: {
        amount: 55n,
        updatedTick: 12,
      },
      ownerStructureId: 77,
      maxStamina: 100,
    });
  });
});
