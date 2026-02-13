import { describe, it, expect } from "vitest";
import { buildWorldState } from "../../src/adapter/world-state";
import { createMockClient } from "../utils/mock-client";

describe("buildWorldState", () => {
  it("returns a valid EternumWorldState", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.tick).toBeGreaterThan(0);
    expect(state.timestamp).toBeGreaterThan(0);
    expect(state.entities).toBeDefined();
    expect(Array.isArray(state.entities)).toBe(true);
  });

  it("merges nearby structures and armies into entities", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const structures = state.entities.filter((e) => e.type === "structure");
    const armies = state.entities.filter((e) => e.type === "army");

    // Only entities within VIEW_RADIUS (5) of an owned entity are included.
    // The bank at (50,60) is too far and gets filtered out.
    expect(structures.length).toBe(2);
    expect(armies.length).toBe(1);
    expect(state.entities.length).toBe(3);
  });

  it("populates structure entities with correct fields", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm).toBeDefined();
    expect(realm!.type).toBe("structure");
    expect(realm!.owner).toBe("0xDeadBeef");
    expect(realm!.position).toEqual({ x: 10, y: 20 });
    expect(realm!.structureType).toBe("Realm");
    expect(realm!.level).toBe(2);
  });

  it("populates army entities with correct fields", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const army = state.entities.find((e) => e.entityId === 100);
    expect(army).toBeDefined();
    expect(army!.type).toBe("army");
    expect(army!.strength).toBe(300); // computeStrength(150, 2) = 300
    expect(army!.stamina).toBe(80); // parseHex("0x50") = 80
    expect(army!.isInBattle).toBe(false);
  });

  it("populates player info from view", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.player.address).toBe("0xdeadbeef");
    expect(state.player.name).toBe("TestPlayer");
    expect(state.player.structures).toBe(1);
    expect(state.player.armies).toBe(1);
    expect(state.player.points).toBe(1200);
    expect(state.player.rank).toBe(5);
  });

  it("populates market summary", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.market.recentSwapCount).toBe(2);
    expect(state.market.openOrderCount).toBe(1);
  });

  it("populates leaderboard summary", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.leaderboard.topPlayers.length).toBe(2);
    expect(state.leaderboard.topPlayers[0].name).toBe("TestPlayer");
    expect(state.leaderboard.totalPlayers).toBe(50);
  });

  it("populates per-structure resources and production buildings from SQL", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    // Global aggregate
    expect(state.resources).toBeDefined();
    expect(state.resources!.get("Wood")).toBe(500);
    expect(state.resources!.get("Stone")).toBe(300);

    // Per-structure resources
    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm!.resources).toBeDefined();
    expect(realm!.resources!.get("Wood")).toBe(500);
    expect(realm!.resources!.get("Stone")).toBe(300);

    // Production buildings
    expect(realm!.productionBuildings).toBeDefined();
    expect(realm!.productionBuildings).toContain("Wood x2");
    expect(realm!.productionBuildings).toContain("Stone x1");

    expect(client.sql.fetchResourceBalancesAndProduction).toHaveBeenCalledWith([1]);
  });

  it("calls sql and view methods", async () => {
    const client = createMockClient() as any;
    await buildWorldState(client, "0xdeadbeef");

    expect(client.view.player).toHaveBeenCalledWith("0xdeadbeef");
    expect(client.view.market).toHaveBeenCalled();
    expect(client.view.leaderboard).toHaveBeenCalledWith({ limit: 10 });
    expect(client.sql.fetchAllStructuresMapData).toHaveBeenCalled();
    expect(client.sql.fetchAllArmiesMapData).toHaveBeenCalled();
  });

  it("filters out entities beyond VIEW_RADIUS of owned positions", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    // Bank at (50,60) is far from owned positions (10,20) and (15,25) — filtered out
    const bank = state.entities.find((e) => e.entityId === 2);
    expect(bank).toBeUndefined();

    // Nearby mine at (13,22) is within 5 hexes of (10,20) — included
    const mine = state.entities.find((e) => e.entityId === 3);
    expect(mine).toBeDefined();
    expect(mine!.owner).toBe("0xother");
  });

  it("marks owned entities with isOwned=true", async () => {
    const client = createMockClient() as any;
    // Use lowercase address — sameAddress does case-insensitive compare
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm!.isOwned).toBe(true);

    const army = state.entities.find((e) => e.entityId === 100);
    expect(army!.isOwned).toBe(true);

    const mine = state.entities.find((e) => e.entityId === 3);
    expect(mine!.isOwned).toBe(false);
  });

  it("populates ownerName from raw SQL data", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm!.ownerName).toBe("TestPlayer");

    const mine = state.entities.find((e) => e.entityId === 3);
    expect(mine!.ownerName).toBe("Rival");

    const army = state.entities.find((e) => e.entityId === 100);
    expect(army!.ownerName).toBe("TestPlayer");
  });

  it("computes guardStrength from guard slots", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    // alpha_count=0x22ECB25C00=150*1B, alpha_tier=T2 → computeStrength(150, 2) = 300
    expect(realm!.guardStrength).toBe(300);

    // Mine has no guards
    const mine = state.entities.find((e) => e.entityId === 3);
    expect(mine!.guardStrength).toBe(0);
  });

  it("builds troopSummary for armies", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const army = state.entities.find((e) => e.entityId === 100);
    // count=0x22ECB25C00=150*1B, category="Knight", tier="T2"
    expect(army!.troopSummary).toBe("150 Knight T2");
  });

  it("populates actions for owned entities only", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm!.actions).toBeDefined();
    expect(realm!.actions).toContain("createExplorer");
    expect(realm!.actions).toContain("addGuard");

    const army = state.entities.find((e) => e.entityId === 100);
    expect(army!.actions).toBeDefined();
    expect(army!.actions).toContain("move");
    expect(army!.actions).toContain("attackExplorer");

    // Non-owned entities have no actions
    const mine = state.entities.find((e) => e.entityId === 3);
    expect(mine!.actions).toBeUndefined();
  });

  it("populates neighborTiles with biome and occupant details for owned armies", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const army = state.entities.find((e) => e.entityId === 100);
    expect(army!.neighborTiles).toBeDefined();
    expect(army!.neighborTiles!.length).toBe(6);

    // Army at (15, 25) — odd row
    // East (16,25) → biome=3 (Beach) → explored, not occupied
    const east = army!.neighborTiles!.find((n) => n.direction === "East");
    expect(east!.explored).toBe(true);
    expect(east!.occupied).toBe(false);
    expect(east!.biome).toBe("Beach");
    expect(east!.occupant).toBeUndefined();

    // NE (15,26) → biome=5 (Bare) → explored, occupied by Chest #999
    const ne = army!.neighborTiles!.find((n) => n.direction === "NE");
    expect(ne!.explored).toBe(true);
    expect(ne!.occupied).toBe(true);
    expect(ne!.biome).toBe("Bare");
    expect(ne!.occupant).toBe("Chest");
    expect(ne!.occupantId).toBe(999);

    // West (14,25) → not in tiles → unexplored
    const west = army!.neighborTiles!.find((n) => n.direction === "West");
    expect(west!.explored).toBe(false);
    expect(west!.biome).toBeUndefined();

    // SW (14,24) → not in tiles → unexplored
    const sw = army!.neighborTiles!.find((n) => n.direction === "SW");
    expect(sw!.explored).toBe(false);

    // SE (15,24) → biome=1 (DeepOcean) → explored, empty
    const se = army!.neighborTiles!.find((n) => n.direction === "SE");
    expect(se!.explored).toBe(true);
    expect(se!.biome).toBe("DeepOcean");
  });

  it("populates buildingSlots from packed_counts for owned structures", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm!.buildingSlots).toBeDefined();
    // Level 2 → total = 3 * 3 * 4 = 36
    expect(realm!.buildingSlots!.total).toBe(36);
    // packed_counts_1 has WorkersHut x2 + Wood x3, packed_counts_3 has Wheat x1 = 6 used
    expect(realm!.buildingSlots!.used).toBe(6);
    expect(realm!.buildingSlots!.buildings).toContain("WorkersHut x2");
    expect(realm!.buildingSlots!.buildings).toContain("Wood x3");
    expect(realm!.buildingSlots!.buildings).toContain("Wheat x1");

    // Non-owned entities have no buildingSlots
    const mine = state.entities.find((e) => e.entityId === 3);
    expect(mine!.buildingSlots).toBeUndefined();
  });

  it("computes population from building counts for owned structures", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm!.population).toBeDefined();
    // WorkersHut x2 = 0 pop cost, +12 capacity; Wood x3 = 6 pop cost; Wheat x1 = 1 pop cost
    // current = 0 + 6 + 1 = 7, capacity = 6 (base) + 12 (huts) = 18
    expect(realm!.population!.current).toBe(7);
    expect(realm!.population!.capacity).toBe(18);

    // Non-owned entities have no population
    const mine = state.entities.find((e) => e.entityId === 3);
    expect(mine!.population).toBeUndefined();
  });

  it("provides next upgrade info for owned realms", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    // Mock realm is level 2 (Kingdom) → next upgrade is Empire
    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm!.nextUpgrade).toBeDefined();
    expect(realm!.nextUpgrade!.name).toBe("Empire");
    expect(realm!.nextUpgrade!.cost).toContain("720 Labor");
    expect(realm!.nextUpgrade!.cost).toContain("4800 Wheat");

    // Non-owned structures have no nextUpgrade
    const mine = state.entities.find((e) => e.entityId === 3);
    expect(mine!.nextUpgrade).toBeUndefined();
  });

  it("counts armies per structure using owner_structure_id", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    // Mock army has owner_structure_id: 1
    expect(realm!.armies).toBeDefined();
    expect(realm!.armies!.current).toBe(1);
    expect(realm!.armies!.max).toBe(1); // Realm max = 1
  });

  it("provides guard slot details for owned structures", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm!.guardSlots).toBeDefined();
    expect(realm!.guardSlots).toHaveLength(4);
    // Alpha has troops, rest are empty
    expect(realm!.guardSlots![0].slot).toBe("Alpha");
    expect(realm!.guardSlots![0].troops).toContain("Knight");
    expect(realm!.guardSlots![1].troops).toBe("empty");
    expect(realm!.guardSlots![2].troops).toBe("empty");
    expect(realm!.guardSlots![3].troops).toBe("empty");

    // Non-owned entities have no guardSlots
    const mine = state.entities.find((e) => e.entityId === 3);
    expect(mine!.guardSlots).toBeUndefined();
  });

  it("parses troop reserves from resource balance rows", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    // Mock has KNIGHT_T1_BALANCE: "0x2E90EDD000" = 200 * 1e9
    expect(realm!.troopsInReserve).toBeDefined();
    expect(realm!.troopsInReserve).toContain("Knight T1: 200");
  });

  it("uses structure category names from numeric types", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm!.structureType).toBe("Realm"); // structure_type: 1

    const mine = state.entities.find((e) => e.entityId === 3);
    expect(mine!.structureType).toBe("Mine"); // structure_type: 4
  });
});
