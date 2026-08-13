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
    getEffectiveHyperstructureRealmCount: vi.fn((value: number) => value),
    getHyperstructureRealmCheckRadius: vi.fn(() => 1),
    getIsBlitz: vi.fn(() => false),
    getStructureTypeName: vi.fn(() => "Structure"),
    unpackBuildingCounts: vi.fn(() => []),
  };
});

const { MapDataStore } = await import("./map-data-store");
const { getEffectiveHyperstructureRealmCount } = await import("../utils");

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
      fetchAllTiles: vi
        .fn()
        .mockResolvedValueOnce([{ col: 1, row: 2, biome: 3, occupier_id: 101, occupier_type: 1 }])
        .mockResolvedValueOnce([]),
    };

    const store = MapDataStore.getInstance(60_000, sqlApi as any);

    await store.refresh();
    expect(store.getStructureById(101)?.entityId).toBe(101);
    expect(store.getAllTiles()).toEqual([{ col: 1, row: 2, biome: 3, occupier_id: 101, occupier_type: 1 }]);
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
    expect(store.getAllTiles()).toEqual([]);
  });

  it("keeps hyperstructure realm count map identity stable across refreshes", async () => {
    const sqlApi = {
      fetchAllStructuresMapData: vi.fn().mockResolvedValue([]),
      fetchAllArmiesMapData: vi.fn().mockResolvedValue([]),
      fetchHyperstructuresWithRealmCount: vi
        .fn()
        .mockResolvedValueOnce([{ hyperstructure_entity_id: 501, realm_count_within_radius: 7 }])
        .mockResolvedValueOnce([{ hyperstructure_entity_id: 502, realm_count_within_radius: 2 }]),
      fetchAllTiles: vi.fn().mockResolvedValue([]),
    };

    const store = MapDataStore.getInstance(60_000, sqlApi as any);

    await store.refresh();
    const cachedMap = store.getRealmCountPerHyperstructure();
    expect(cachedMap.get(501 as any)).toBe(7);

    await store.refresh();

    expect(store.getRealmCountPerHyperstructure()).toBe(cachedMap);
    expect(cachedMap.get(501 as any)).toBeUndefined();
    expect(cachedMap.get(502 as any)).toBe(2);
  });

  it("keeps a structure row live-written during an in-flight refresh, while older writes stay last-write-wins", async () => {
    vi.useFakeTimers();
    try {
      const structureRow = (entityId: number, overrides: Record<string, unknown> = {}) => ({
        entity_id: entityId,
        internal_entity_id: `0x${entityId.toString(16)}`,
        coord_x: 10,
        coord_y: 11,
        structure_type: 2,
        level: 3,
        owner_address: "0x1",
        owner_name: "0x0",
        realm_id: 0,
        packed_counts_1: null,
        packed_counts_2: null,
        packed_counts_3: null,
        ...overrides,
      });

      let resolveSnapshot!: (rows: unknown[]) => void;
      const deferredSnapshot = new Promise<unknown[]>((resolve) => {
        resolveSnapshot = resolve;
      });

      const sqlApi = {
        fetchAllStructuresMapData: vi
          .fn()
          .mockResolvedValueOnce([structureRow(101), structureRow(102)])
          .mockReturnValueOnce(deferredSnapshot),
        fetchAllArmiesMapData: vi.fn().mockResolvedValue([]),
        fetchHyperstructuresWithRealmCount: vi.fn().mockResolvedValue([]),
        fetchAllTiles: vi.fn().mockResolvedValue([]),
      };

      const store = MapDataStore.getInstance(60_000, sqlApi as any);
      await store.refresh();

      // Live write BEFORE the second fetch starts — the snapshot is newer, so
      // it must win (the guard entry expires).
      store.updateStructureGuards(101, [{ slot: 0, category: "Knight", tier: 1, count: 5, stamina: 50 }], 111);

      vi.advanceTimersByTime(5);
      const refreshPromise = store.refresh();

      // Live write DURING the in-flight fetch — newer than the snapshot's
      // start timestamp, so it must survive the refresh apply.
      vi.advanceTimersByTime(5);
      store.updateStructureGuards(102, [{ slot: 0, category: "Paladin", tier: 2, count: 9, stamina: 70 }], 222);

      resolveSnapshot([
        structureRow(101, { delta_count: "0x1", delta_category: "1", delta_tier: "T1", delta_stamina_amount: "0x2" }),
        structureRow(102),
      ]);
      await refreshPromise;

      // 101: snapshot taken after its live write — snapshot wins.
      expect(store.getStructureById(101)?.guardArmies).toEqual([
        { slot: 0, category: "Knight", tier: 1, count: 1, stamina: 2 },
      ]);
      // 102: live write landed while the snapshot was in flight — it survives.
      expect(store.getStructureById(102)?.guardArmies).toEqual([
        { slot: 0, category: "Paladin", tier: 2, count: 9, stamina: 70 },
      ]);
      expect(store.getStructureById(102)?.battleData?.battleCooldownEnd).toBe(222);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never rolls an army back to a snapshot row with an older stamina tick", async () => {
    const armyRow = (entityId: number, overrides: Record<string, unknown> = {}) => ({
      entity_id: entityId,
      internal_entity_id: `0x${entityId.toString(16)}`,
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
      ...overrides,
    });

    const sqlApi = {
      fetchAllStructuresMapData: vi.fn().mockResolvedValue([]),
      fetchAllArmiesMapData: vi
        .fn()
        .mockResolvedValueOnce([
          armyRow(301, { stamina_amount: "0x40", stamina_updated_tick: "0x10", coord_x: 35 }),
          armyRow(302, { stamina_updated_tick: "0x3" }),
        ])
        .mockResolvedValueOnce([
          // 301 regresses (older tick) — the cached row must win.
          armyRow(301, { stamina_amount: "0x99", stamina_updated_tick: "0x5", coord_x: 30 }),
          // 302 advances (newer tick) — the snapshot must win.
          armyRow(302, { stamina_amount: "0x20", stamina_updated_tick: "0x8", coord_x: 99 }),
        ]),
      fetchHyperstructuresWithRealmCount: vi.fn().mockResolvedValue([]),
      fetchAllTiles: vi.fn().mockResolvedValue([]),
    };

    const store = MapDataStore.getInstance(60_000, sqlApi as any);
    await store.refresh();
    await store.refresh();

    const guarded = store.getArmyById(301);
    expect(guarded?.stamina).toEqual({ amount: 0x40n, updated_tick: 0x10n });
    expect(guarded?.coordX).toBe(35);

    const advanced = store.getArmyById(302);
    expect(advanced?.stamina).toEqual({ amount: 0x20n, updated_tick: 0x8n });
    expect(advanced?.coordX).toBe(99);
  });

  it("forces realm count to 2 for all hyperstructures in two-player mode", async () => {
    vi.mocked(getEffectiveHyperstructureRealmCount).mockImplementation(() => 2);

    const sqlApi = {
      fetchAllStructuresMapData: vi.fn().mockResolvedValue([]),
      fetchAllArmiesMapData: vi.fn().mockResolvedValue([]),
      fetchHyperstructuresWithRealmCount: vi.fn().mockResolvedValue([
        { hyperstructure_entity_id: 601, realm_count_within_radius: 0 },
        { hyperstructure_entity_id: 602, realm_count_within_radius: 5 },
      ]),
      fetchAllTiles: vi.fn().mockResolvedValue([]),
    };

    const store = MapDataStore.getInstance(60_000, sqlApi as any);
    await store.refresh();

    expect(store.getHyperstructureRealmCount(601 as any)).toBe(2);
    expect(store.getHyperstructureRealmCount(602 as any)).toBe(2);
  });
});
