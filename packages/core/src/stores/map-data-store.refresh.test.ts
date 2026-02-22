import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@bibliothecadao/types", () => ({
  GuardSlot: {
    Delta: 0,
    Charlie: 1,
    Bravo: 2,
    Alpha: 3,
  },
}));

vi.mock("../utils", () => {
  return {
    divideByPrecision: vi.fn((value: number) => value),
    getHyperstructureRealmCheckRadius: vi.fn(() => 1),
    getIsBlitz: vi.fn(() => false),
    getStructureTypeName: vi.fn(() => "Structure"),
    unpackBuildingCounts: vi.fn(() => []),
  };
});

const { MapDataStore } = await import("./map-data-store");

describe("MapDataStore refresh semantics", () => {
  beforeEach(() => {
    MapDataStore.clearIfExists();
  });

  afterEach(() => {
    MapDataStore.clearIfExists();
    vi.restoreAllMocks();
  });

  it("rebuilds caches without retaining stale structures, armies, owner names, or entity ids", async () => {
    const sqlApi = {
      fetchAllStructuresMapData: vi
        .fn()
        .mockResolvedValueOnce([
          {
            entity_id: 101,
            internal_entity_id: "0x00101",
            coord_x: 10,
            coord_y: 11,
            structure_type: 2,
            level: 3,
            owner_address: "0x1",
            owner_name: "0x0",
            realm_id: 1,
            packed_counts_1: null,
            packed_counts_2: null,
            packed_counts_3: null,
          },
        ])
        .mockResolvedValueOnce([
          {
            entity_id: 202,
            internal_entity_id: "0x00202",
            coord_x: 20,
            coord_y: 21,
            structure_type: 3,
            level: 1,
            owner_address: "0x2",
            owner_name: "0x0",
            realm_id: 2,
            packed_counts_1: null,
            packed_counts_2: null,
            packed_counts_3: null,
          },
        ]),
      fetchAllArmiesMapData: vi
        .fn()
        .mockResolvedValueOnce([
          {
            entity_id: 301,
            internal_entity_id: "0x00301",
            coord_x: 30,
            coord_y: 31,
            owner_structure_id: 101,
            category: "1",
            tier: "T1",
            count: "0x10",
            stamina_amount: "0x10",
            stamina_updated_tick: "0x5",
            owner_address: "0x1",
            owner_name: "0x0",
          },
        ])
        .mockResolvedValueOnce([]),
      fetchHyperstructuresWithRealmCount: vi
        .fn()
        .mockResolvedValueOnce([{ hyperstructure_entity_id: 501, realm_count_within_radius: 7 }])
        .mockResolvedValueOnce([{ hyperstructure_entity_id: 502, realm_count_within_radius: 2 }]),
    };

    const store = MapDataStore.getInstance(60_000, sqlApi as any);

    await store.refresh();
    expect(store.getStructureById(101)?.entityId).toBe(101);
    expect(store.getArmyById(301)?.entityId).toBe(301);
    expect(store.getEntityIdFromEntity("0x101")).toBe(101);
    expect(store.getHyperstructureRealmCount(501 as any)).toBe(7);

    await store.refresh();

    expect(store.getStructureCount()).toBe(1);
    expect(store.getArmyCount()).toBe(0);
    expect(store.getStructureById(101)).toBeUndefined();
    expect(store.getArmyById(301)).toBeUndefined();
    expect(store.getEntityIdFromEntity("0x101")).toBeUndefined();
    expect(store.getPlayerName("0x1")).toBe("");
    expect(store.getHyperstructureRealmCount(501 as any)).toBeUndefined();
    expect(store.getHyperstructureRealmCount(502 as any)).toBe(2);
  });
});
