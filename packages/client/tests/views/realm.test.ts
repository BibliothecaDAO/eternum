import { describe, expect, it, vi, beforeEach } from "vitest";
import { ViewClient } from "../../src/views";
import type { SqlApiLike } from "../../src/views";
import { ViewCache } from "../../src/cache";
import type { RealmView } from "../../src/types/views";

function createMockSql(overrides: Partial<SqlApiLike> = {}): SqlApiLike {
  return {
    fetchPlayerStructures: vi.fn().mockResolvedValue([
      {
        entity_id: 42,
        realm_id: 7,
        name: "Test Realm",
        owner: "0xABC",
        coord_x: 10,
        coord_y: 20,
        level: 3,
        category: "Realm",
      },
    ]),
    fetchGuardsByStructure: vi.fn().mockResolvedValue([
      {
        slot: 0,
        troops: { category: "Knight", tier: 2, count: 100 },
        destroyedTick: 0,
        cooldownEnd: 0,
      },
    ]),
    fetchAllArmiesMapData: vi.fn().mockResolvedValue([
      {
        entity_id: 99,
        explorer_id: 99,
        owner: "0xABC",
        coord_x: 11,
        coord_y: 21,
        stamina: 50,
        is_in_battle: false,
      },
    ]),
    fetchAllStructuresMapData: vi.fn().mockResolvedValue([]),
    fetchAllTiles: vi.fn().mockResolvedValue([]),
    fetchBattleLogs: vi.fn().mockResolvedValue([]),
    fetchHyperstructures: vi.fn().mockResolvedValue([]),
    fetchSwapEvents: vi.fn().mockResolvedValue([]),
    fetchPlayerLeaderboard: vi.fn().mockResolvedValue([]),
    fetchStoryEvents: vi.fn().mockResolvedValue([]),
    fetchStoryEventsByEntity: vi.fn().mockResolvedValue([]),
    fetchStoryEventsByOwner: vi.fn().mockResolvedValue([]),
    fetchStoryEventsCount: vi.fn().mockResolvedValue(0),
    fetchStructuresByOwner: vi.fn().mockResolvedValue([]),
    fetchExplorerAddressOwner: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("ViewClient.realm", () => {
  let sql: SqlApiLike;
  let cache: ViewCache;
  let client: ViewClient;

  beforeEach(() => {
    sql = createMockSql();
    cache = new ViewCache(5000);
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);
  });

  it("returns a RealmView with correct structure", async () => {
    const view: RealmView = await client.realm(42);

    expect(view.entityId).toBe(42);
    expect(view.realmId).toBe(7);
    expect(view.name).toBe("Test Realm");
    expect(view.owner).toBe("0xABC");
    expect(view.position).toEqual({ x: 10, y: 20 });
    expect(view.level).toBe(3);
  });

  it("populates guard state from fetched guards", async () => {
    const view = await client.realm(42);

    expect(view.guard.totalTroops).toBe(100);
    expect(view.guard.slots).toHaveLength(1);
    expect(view.guard.slots[0]).toEqual({
      troopType: "Knight",
      count: 100,
      tier: 2,
    });
    // strength = count * tier
    expect(view.guard.strength).toBe(200);
  });

  it("populates explorers from army data", async () => {
    const view = await client.realm(42);

    expect(view.explorers).toHaveLength(1);
    expect(view.explorers[0].entityId).toBe(99);
    expect(view.explorers[0].position).toEqual({ x: 11, y: 21 });
    expect(view.explorers[0].stamina).toBe(50);
  });

  it("returns empty arrays for fields not fully computable", async () => {
    const view = await client.realm(42);

    expect(view.resources).toEqual([]);
    expect(view.productions).toEqual([]);
    expect(view.buildings).toEqual([]);
    expect(view.incomingArrivals).toEqual([]);
    expect(view.outgoingOrders).toEqual([]);
    expect(view.relics).toEqual([]);
    expect(view.activeBattles).toEqual([]);
    expect(view.nearbyEntities).toEqual([]);
  });

  it("caches the result on first call", async () => {
    await client.realm(42);

    // Second call should return cached data without hitting SQL again
    const view2 = await client.realm(42);

    expect(view2.entityId).toBe(42);
    // fetchPlayerStructures should only have been called once
    expect(sql.fetchPlayerStructures).toHaveBeenCalledTimes(1);
    expect(sql.fetchGuardsByStructure).toHaveBeenCalledTimes(1);
    expect(sql.fetchAllArmiesMapData).toHaveBeenCalledTimes(1);
  });

  it("handles empty guard data gracefully", async () => {
    sql = createMockSql({
      fetchGuardsByStructure: vi.fn().mockResolvedValue([]),
    });
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);

    const view = await client.realm(42);

    expect(view.guard.totalTroops).toBe(0);
    expect(view.guard.slots).toEqual([]);
    expect(view.guard.strength).toBe(0);
  });

  it("handles empty army data gracefully", async () => {
    sql = createMockSql({
      fetchAllArmiesMapData: vi.fn().mockResolvedValue([]),
    });
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);

    const view = await client.realm(42);

    expect(view.explorers).toEqual([]);
  });

  it("uses fallback realm name when structure has no name", async () => {
    sql = createMockSql({
      fetchPlayerStructures: vi.fn().mockResolvedValue([
        { entity_id: 42, coord_x: 0, coord_y: 0 },
      ]),
    });
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);

    const view = await client.realm(42);

    expect(view.name).toBe("Realm #42");
  });

  it("uses fallback owner when no account is connected", async () => {
    client = new ViewClient(sql, cache, () => null, () => 1000);

    const view = await client.realm(42);

    // Should still work -- uses "0x0" as fallback owner for the query
    expect(view).toBeDefined();
    expect(view.entityId).toBe(42);
  });
});

describe("ViewClient.explorer", () => {
  let sql: SqlApiLike;
  let cache: ViewCache;
  let client: ViewClient;

  beforeEach(() => {
    sql = createMockSql();
    cache = new ViewCache(5000);
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);
  });

  it("returns an ExplorerView with correct structure", async () => {
    const view = await client.explorer(99);

    expect(view.entityId).toBe(99);
    expect(view.position).toEqual({ x: 11, y: 21 });
    expect(view.stamina).toBe(50);
    expect(view.isInBattle).toBe(false);
    expect(view.currentBattle).toBeNull();
  });

  it("caches the explorer result", async () => {
    await client.explorer(99);
    await client.explorer(99);

    expect(sql.fetchAllArmiesMapData).toHaveBeenCalledTimes(1);
  });
});

describe("ViewClient.mapArea", () => {
  let sql: SqlApiLike;
  let cache: ViewCache;
  let client: ViewClient;

  beforeEach(() => {
    sql = createMockSql({
      fetchAllStructuresMapData: vi.fn().mockResolvedValue([
        { entity_id: 1, coord_x: 5, coord_y: 5, owner: "0x1", category: "Realm", name: "A", level: 1 },
        { entity_id: 2, coord_x: 100, coord_y: 100, owner: "0x2", category: "Bank", name: "B", level: 1 },
      ]),
      fetchAllArmiesMapData: vi.fn().mockResolvedValue([
        { entity_id: 10, coord_x: 6, coord_y: 6, owner: "0x1", stamina: 80, is_in_battle: false },
      ]),
      fetchAllTiles: vi.fn().mockResolvedValue([
        { col: 5, row: 5, biome: "forest", explored: true, occupier_id: null },
        { col: 200, row: 200, biome: "desert", explored: false, occupier_id: null },
      ]),
    });
    cache = new ViewCache(5000);
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);
  });

  it("filters structures within radius", async () => {
    const view = await client.mapArea({ x: 5, y: 5, radius: 3 });

    expect(view.structures).toHaveLength(1);
    expect(view.structures[0].entityId).toBe(1);
  });

  it("filters armies within radius", async () => {
    const view = await client.mapArea({ x: 5, y: 5, radius: 3 });

    expect(view.armies).toHaveLength(1);
    expect(view.armies[0].entityId).toBe(10);
  });

  it("filters tiles within radius", async () => {
    const view = await client.mapArea({ x: 5, y: 5, radius: 3 });

    expect(view.tiles).toHaveLength(1);
    expect(view.tiles[0].biome).toBe("forest");
  });

  it("sets center and radius on the result", async () => {
    const view = await client.mapArea({ x: 5, y: 5, radius: 3 });

    expect(view.center).toEqual({ x: 5, y: 5 });
    expect(view.radius).toBe(3);
  });

  it("caches mapArea results", async () => {
    await client.mapArea({ x: 5, y: 5, radius: 3 });
    await client.mapArea({ x: 5, y: 5, radius: 3 });

    expect(sql.fetchAllStructuresMapData).toHaveBeenCalledTimes(1);
  });
});

describe("ViewClient.market", () => {
  let sql: SqlApiLike;
  let cache: ViewCache;
  let client: ViewClient;

  beforeEach(() => {
    sql = createMockSql({
      fetchSwapEvents: vi.fn().mockResolvedValue([
        {
          type: "SWAP",
          event: {
            takerId: 1,
            resourceGiven: { resourceId: 1, amount: 100 },
            resourceTaken: { resourceId: 2, amount: 50 },
            takerAddress: "0xTrader",
            eventTime: new Date("2025-01-01T00:00:00Z"),
          },
        },
      ]),
    });
    cache = new ViewCache(5000);
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);
  });

  it("returns a MarketView with recent swaps", async () => {
    const view = await client.market();

    expect(view.recentSwaps).toHaveLength(1);
    expect(view.recentSwaps[0].trader).toBe("0xTrader");
    expect(view.pools).toEqual([]);
    expect(view.openOrders).toEqual([]);
    expect(view.playerLpPositions).toEqual([]);
  });

  it("caches market results", async () => {
    await client.market();
    await client.market();

    expect(sql.fetchSwapEvents).toHaveBeenCalledTimes(1);
  });
});

describe("ViewClient.player", () => {
  let sql: SqlApiLike;
  let cache: ViewCache;
  let client: ViewClient;

  beforeEach(() => {
    sql = createMockSql({
      fetchStructuresByOwner: vi.fn().mockResolvedValue([
        { entity_id: 1, category: "Realm", name: "MyRealm", coord_x: 5, coord_y: 5, level: 2 },
      ]),
      fetchAllArmiesMapData: vi.fn().mockResolvedValue([
        { entity_id: 10, owner: "0xPlayer", coord_x: 6, coord_y: 6, stamina: 70, is_in_battle: true },
      ]),
      fetchPlayerLeaderboard: vi.fn().mockResolvedValue([
        { playerAddress: "0xPlayer", playerName: "TestPlayer", totalPoints: 1500, rank: 3, realmCount: 2 },
      ]),
    });
    cache = new ViewCache(5000);
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);
  });

  it("returns a PlayerView with structures", async () => {
    const view = await client.player("0xPlayer");

    expect(view.address).toBe("0xPlayer");
    expect(view.name).toBe("TestPlayer");
    expect(view.structures).toHaveLength(1);
    expect(view.structures[0].name).toBe("MyRealm");
  });

  it("returns armies owned by the player", async () => {
    const view = await client.player("0xPlayer");

    expect(view.armies).toHaveLength(1);
    expect(view.armies[0].isInBattle).toBe(true);
  });

  it("returns leaderboard data", async () => {
    const view = await client.player("0xPlayer");

    expect(view.points).toBe(1500);
    expect(view.rank).toBe(3);
  });

  it("uses address-specific leaderboard entry when top row is a different player", async () => {
    sql = createMockSql({
      fetchStructuresByOwner: vi.fn().mockResolvedValue([]),
      fetchAllArmiesMapData: vi.fn().mockResolvedValue([]),
      fetchPlayerLeaderboardByAddress: vi.fn().mockResolvedValue({
        playerAddress: "0xPlayer",
        playerName: "AddressMatched",
        totalPoints: 777,
        rank: 9,
        realmCount: 1,
      }),
      fetchPlayerLeaderboard: vi.fn().mockResolvedValue([
        { playerAddress: "0xSomeoneElse", playerName: "Top", totalPoints: 9999, rank: 1, realmCount: 10 },
      ]),
    } as any);
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);

    const view = await client.player("0xPlayer");

    expect(view.name).toBe("AddressMatched");
    expect(view.points).toBe(777);
    expect(view.rank).toBe(9);
  });

  it("aggregates totalResources from structure payload resources", async () => {
    sql = createMockSql({
      fetchStructuresByOwner: vi.fn().mockResolvedValue([
        {
          entity_id: 1,
          category: "Realm",
          name: "ResourceRealm",
          coord_x: 5,
          coord_y: 5,
          level: 2,
          resources: [
            { resourceId: 1, name: "Wood", amount: 100 },
            { resourceId: 2, name: "Stone", amount: 40 },
          ],
        },
        {
          entity_id: 2,
          category: "Village",
          name: "Outpost",
          coord_x: 7,
          coord_y: 8,
          level: 1,
          resources: [
            { resourceId: 1, name: "Wood", amount: 20 },
            { resourceId: 2, name: "Stone", amount: 10 },
          ],
        },
      ]),
      fetchAllArmiesMapData: vi.fn().mockResolvedValue([]),
      fetchPlayerLeaderboardByAddress: vi.fn().mockResolvedValue(null),
      fetchPlayerLeaderboard: vi.fn().mockResolvedValue([]),
      fetchPlayerStructures: vi.fn().mockResolvedValue([]),
    } as any);
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);

    const view = await client.player("0xPlayer");

    expect(view.totalResources).toEqual([
      {
        resourceId: 1,
        name: "Wood",
        totalBalance: 120,
        totalProduction: 0,
        structureCount: 2,
      },
      {
        resourceId: 2,
        name: "Stone",
        totalBalance: 50,
        totalProduction: 0,
        structureCount: 2,
      },
    ]);
  });

  it("caches player results", async () => {
    await client.player("0xPlayer");
    await client.player("0xPlayer");

    expect(sql.fetchStructuresByOwner).toHaveBeenCalledTimes(1);
  });
});

describe("ViewClient.hyperstructure", () => {
  let sql: SqlApiLike;
  let cache: ViewCache;
  let client: ViewClient;

  beforeEach(() => {
    sql = createMockSql({
      fetchHyperstructures: vi.fn().mockResolvedValue([
        { entity_id: 200, coord_x: 50, coord_y: 50, owner: "0xOwner", progress: 75 },
      ]),
      fetchGuardsByStructure: vi.fn().mockResolvedValue([]),
    });
    cache = new ViewCache(5000);
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);
  });

  it("returns a HyperstructureView", async () => {
    const view = await client.hyperstructure(200);

    expect(view.entityId).toBe(200);
    expect(view.position).toEqual({ x: 50, y: 50 });
    expect(view.owner).toBe("0xOwner");
    expect(view.progress).toBe(75);
    expect(view.isComplete).toBe(false);
  });

  it("marks hyperstructure as complete at 100%", async () => {
    sql = createMockSql({
      fetchHyperstructures: vi.fn().mockResolvedValue([
        { entity_id: 200, coord_x: 50, coord_y: 50, owner: "0xOwner", progress: 100 },
      ]),
      fetchGuardsByStructure: vi.fn().mockResolvedValue([]),
    });
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);

    const view = await client.hyperstructure(200);

    expect(view.isComplete).toBe(true);
  });

  it("caches hyperstructure results", async () => {
    await client.hyperstructure(200);
    await client.hyperstructure(200);

    expect(sql.fetchHyperstructures).toHaveBeenCalledTimes(1);
  });
});

describe("ViewClient.leaderboard", () => {
  let sql: SqlApiLike;
  let cache: ViewCache;
  let client: ViewClient;

  beforeEach(() => {
    sql = createMockSql({
      fetchPlayerLeaderboard: vi.fn().mockResolvedValue([
        { playerAddress: "0x1", playerName: "Alice", totalPoints: 2000, rank: 1, realmCount: 5 },
        { playerAddress: "0x2", playerName: "Bob", totalPoints: 1500, rank: 2, realmCount: 3 },
      ]),
    });
    cache = new ViewCache(5000);
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);
  });

  it("returns a LeaderboardView", async () => {
    const view = await client.leaderboard({ limit: 10, offset: 0 });

    expect(view.entries).toHaveLength(2);
    expect(view.entries[0].name).toBe("Alice");
    expect(view.entries[0].points).toBe(2000);
    expect(view.entries[1].name).toBe("Bob");
    expect(view.totalPlayers).toBe(2);
  });

  it("uses default limit and offset", async () => {
    await client.leaderboard();

    expect(sql.fetchPlayerLeaderboard).toHaveBeenCalledWith(10, 0);
  });

  it("caches leaderboard results", async () => {
    await client.leaderboard({ limit: 10, offset: 0 });
    await client.leaderboard({ limit: 10, offset: 0 });

    expect(sql.fetchPlayerLeaderboard).toHaveBeenCalledTimes(1);
  });
});

describe("ViewClient.bank", () => {
  let sql: SqlApiLike;
  let cache: ViewCache;
  let client: ViewClient;

  beforeEach(() => {
    sql = createMockSql({
      fetchAllStructuresMapData: vi.fn().mockResolvedValue([
        { entity_id: 300, coord_x: 30, coord_y: 40, category: "Bank" },
      ]),
      fetchSwapEvents: vi.fn().mockResolvedValue([]),
    });
    cache = new ViewCache(5000);
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);
  });

  it("returns a BankView", async () => {
    const view = await client.bank(300);

    expect(view.entityId).toBe(300);
    expect(view.position).toEqual({ x: 30, y: 40 });
    expect(view.pools).toEqual([]);
    expect(view.recentSwaps).toEqual([]);
    expect(view.playerLpPositions).toEqual([]);
  });

  it("caches bank results", async () => {
    await client.bank(300);
    await client.bank(300);

    expect(sql.fetchAllStructuresMapData).toHaveBeenCalledTimes(1);
  });
});

describe("ViewClient.events", () => {
  let sql: SqlApiLike;
  let cache: ViewCache;
  let client: ViewClient;

  beforeEach(() => {
    sql = createMockSql({
      fetchStoryEvents: vi.fn().mockResolvedValue([
        { event_id: 1, event_type: "battle", timestamp: 999, data: {}, involved_entities: [10, 20] },
        { event_id: 2, event_type: "trade", timestamp: 998, data: {}, involved_entities: [30] },
      ]),
      fetchStoryEventsCount: vi.fn().mockResolvedValue(100),
    });
    cache = new ViewCache(5000);
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);
  });

  it("returns an EventsView", async () => {
    const view = await client.events({ limit: 10, offset: 0 });

    expect(view.events).toHaveLength(2);
    expect(view.events[0].eventType).toBe("battle");
    expect(view.events[0].involvedEntities).toEqual([10, 20]);
    expect(view.totalCount).toBe(100);
    expect(view.hasMore).toBe(true);
  });

  it("queries by entity ID when provided", async () => {
    const fetchByEntity = vi.fn().mockResolvedValue([]);
    sql = createMockSql({
      fetchStoryEventsByEntity: fetchByEntity,
      fetchStoryEventsCount: vi.fn().mockResolvedValue(0),
    });
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);

    await client.events({ entityId: 42 });

    expect(fetchByEntity).toHaveBeenCalledWith(42, 50, 0);
  });

  it("queries by owner when provided", async () => {
    const fetchByOwner = vi.fn().mockResolvedValue([]);
    sql = createMockSql({
      fetchStoryEventsByOwner: fetchByOwner,
      fetchStoryEventsCount: vi.fn().mockResolvedValue(0),
    });
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);

    await client.events({ owner: "0xOwner" });

    expect(fetchByOwner).toHaveBeenCalledWith("0xOwner", 50, 0);
  });

  it("caches events results", async () => {
    await client.events({ limit: 10, offset: 0 });
    await client.events({ limit: 10, offset: 0 });

    expect(sql.fetchStoryEvents).toHaveBeenCalledTimes(1);
  });

  it("returns hasMore=false when all events are fetched", async () => {
    sql = createMockSql({
      fetchStoryEvents: vi.fn().mockResolvedValue([
        { event_id: 1, event_type: "battle", timestamp: 999, data: {} },
      ]),
      fetchStoryEventsCount: vi.fn().mockResolvedValue(1),
    });
    client = new ViewClient(sql, cache, () => "0xABC", () => 1000);

    const view = await client.events({ limit: 10, offset: 0 });

    expect(view.hasMore).toBe(false);
  });
});
