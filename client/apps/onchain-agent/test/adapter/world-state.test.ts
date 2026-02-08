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

  it("merges structures and armies into entities", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const structures = state.entities.filter((e) => e.type === "structure");
    const armies = state.entities.filter((e) => e.type === "army");

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
    expect(realm!.owner).toBe("0xdeadbeef");
    expect(realm!.position).toEqual({ x: 10, y: 20 });
    expect(realm!.structureType).toBe("realm");
    expect(realm!.level).toBe(2);
  });

  it("populates army entities with correct fields", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const army = state.entities.find((e) => e.entityId === 100);
    expect(army).toBeDefined();
    expect(army!.type).toBe("army");
    expect(army!.strength).toBe(50);
    // Stamina is overridden by explorer detail view (75) over player summary (80)
    expect(army!.stamina).toBe(75);
    expect(army!.isInBattle).toBe(false);
    // Explorer enrichment fields
    expect(army!.explorerId).toBe(100);
    expect(army!.troops).toEqual({
      totalTroops: 15,
      slots: [{ troopType: "Crossbowman", count: 15, tier: 1 }],
      strength: 200,
    });
    expect(army!.carriedResources).toEqual([{ resourceId: 1, name: "Wood", amount: 50 }]);
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

  it("populates resources map from player totalResources", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.resources).toBeDefined();
    expect(state.resources!.get("Wood")).toBe(500);
    expect(state.resources!.get("Stone")).toBe(300);
  });

  it("calls all view methods and bounded SQL in parallel", async () => {
    const client = createMockClient() as any;
    await buildWorldState(client, "0xdeadbeef");

    expect(client.view.player).toHaveBeenCalledWith("0xdeadbeef");
    expect(client.view.market).toHaveBeenCalled();
    expect(client.view.leaderboard).toHaveBeenCalledWith({ limit: 10 });
    // Bounded SQL queries instead of view.mapArea
    expect(client.sql.fetchTilesInArea).toHaveBeenCalledWith({ x: 10, y: 20 }, 50);
    expect(client.sql.fetchStructuresInArea).toHaveBeenCalledWith({ x: 10, y: 20 }, 50);
    expect(client.sql.fetchArmiesInArea).toHaveBeenCalledWith({ x: 10, y: 20 }, 50);
  });

  it("enriches structures with realm detail (guards, buildings, resources)", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm).toBeDefined();
    expect(client.view.realm).toHaveBeenCalledWith(1);
    expect(realm!.guardSlots).toEqual([
      { troopType: "Knight", count: 20, tier: 1 },
      { troopType: "Paladin", count: 10, tier: 2 },
    ]);
    expect(realm!.guardStrength).toBe(500);
    // Buildings come from sql.fetchBuildingsByStructure, not realm view
    expect(client.sql.fetchBuildingsByStructure).toHaveBeenCalledWith(1);
    expect(realm!.buildings).toEqual([
      { category: "Farm", paused: false, position: { x: 10, y: 10 } },
      { category: "Wood", paused: false, position: { x: 11, y: 10 } },
      { category: "Knight Barracks", paused: true, position: { x: 12, y: 10 } },
    ]);
    // Resource balances come from sql.fetchResourceBalances, not realm view
    expect(client.sql.fetchResourceBalances).toHaveBeenCalledWith(1);
    expect(realm!.resourceBalances).toEqual([
      { resourceId: 1, name: "Stone", balance: 2400 },
      { resourceId: 3, name: "Wood", balance: 4000 },
    ]);
  });

  it("calls explorer() for each player army", async () => {
    const client = createMockClient() as any;
    await buildWorldState(client, "0xdeadbeef");

    expect(client.view.explorer).toHaveBeenCalledWith(100);
  });

  it("includes recent events from events view", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(client.view.events).toHaveBeenCalledWith({ owner: "0xdeadbeef", limit: 10 });
    expect(state.recentEvents).toEqual([
      { eventId: 1, eventType: "battle_start", timestamp: 1700000000, data: { attackerId: 100 } },
    ]);
  });

  it("identifies bank entities from nearby structures", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.banks).toEqual([
      { entityId: 2, position: { x: 50, y: 60 } },
    ]);
  });

  it("handles realm() failure gracefully without crashing", async () => {
    const client = createMockClient() as any;
    client.view.realm.mockRejectedValue(new Error("SQL timeout"));
    const state = await buildWorldState(client, "0xdeadbeef");

    // Structure still exists, just without enrichment
    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm).toBeDefined();
    expect(realm!.guardSlots).toBeUndefined();
  });

  it("handles explorer() failure gracefully without crashing", async () => {
    const client = createMockClient() as any;
    client.view.explorer.mockRejectedValue(new Error("SQL timeout"));
    const state = await buildWorldState(client, "0xdeadbeef");

    // Army still exists, just without enrichment
    const army = state.entities.find((e) => e.entityId === 100);
    expect(army).toBeDefined();
    expect(army!.troops).toBeUndefined();
  });

  // --- Phase 1: Tile Visibility ---

  it("includes tile data from bounded SQL queries", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.tiles).toBeDefined();
    expect(state.tiles!.exploredCount).toBe(4); // 4 tiles from fetchTilesInArea mock
    expect(client.sql.fetchTilesInArea).toHaveBeenCalled();
  });

  it("computes frontier tiles correctly", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    // Frontier tiles = explored tiles with at least one neighbor NOT in the explored set
    // (10,20) neighbors: (11,20)✓ (9,20)✓ (10,21)✗ (10,19)✗ → frontier
    // (11,20) neighbors: (12,20)✗ (10,20)✓ (11,21)✓ (11,19)✗ → frontier
    // (9,20) neighbors: (10,20)✓ (8,20)✗ (9,21)✗ (9,19)✗ → frontier
    // (11,21) neighbors: (12,21)✗ (10,21)✗ (11,22)✗ (11,20)✓ → frontier
    // All 4 tiles are frontier tiles since they all border unexplored territory
    expect(state.tiles).toBeDefined();
    expect(state.tiles!.frontierTiles.length).toBe(4);
    // Check that frontier tiles have position and biome name (not number)
    for (const ft of state.tiles!.frontierTiles) {
      expect(ft.x).toBeDefined();
      expect(ft.y).toBeDefined();
      expect(typeof ft.biome).toBe("string");
    }
  });

  // --- Phase 1: Game Config ---

  it("includes gameConfig from live SQL", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.gameConfig).toBeDefined();
    expect(state.gameConfig!.stamina).toBeDefined();
    expect(state.gameConfig!.realm).toBeDefined();
    expect(state.gameConfig!.buildings).toBeDefined();
    expect(state.gameConfig!.combat).toBeDefined();
    expect(state.gameConfig!.tick).toBeDefined();
  });

  it("gameConfig has correct stamina values from WorldConfig", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const stamina = state.gameConfig!.stamina;
    expect(stamina.exploreCost).toBe(30);
    expect(stamina.travelCost).toBe(20);
    expect(stamina.gainPerTick).toBe(20);
    expect(stamina.bonusValue).toBe(10);
    expect(stamina.attackReq).toBe(50);
    expect(stamina.defenseReq).toBe(40);
    expect(stamina.maxStamina.knight).toBe(120);
    expect(stamina.maxStamina.paladin).toBe(120);
    expect(stamina.maxStamina.crossbowman).toBe(120);
    expect(stamina.exploreWheatCost).toBe(30000000);
    expect(stamina.travelWheatCost).toBe(30000000);
  });

  it("gameConfig has realm upgrade info with resolved resource costs", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.gameConfig!.realm.maxLevel).toBe(3);
    expect(state.gameConfig!.realm.upgradeCosts).toBeDefined();
    expect(state.gameConfig!.realm.upgradeCosts.length).toBe(3);
    // Level 1 has required_resources_id=3, mock ResourceList has 3 entries for entity_id=3
    const level1 = state.gameConfig!.realm.upgradeCosts[0];
    expect(level1.level).toBe(1);
    expect(level1.resources).toBeDefined();
    expect(level1.resources!.length).toBe(3);
    expect(level1.resources![0].resourceType).toBe(23);
  });

  it("gameConfig has building and combat config", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.gameConfig!.buildings.basePopulation).toBe(6);
    expect(state.gameConfig!.buildings.costIncreasePercent).toBe(1000);
    expect(state.gameConfig!.combat.biomeBonusNum).toBe(3000);
    expect(state.gameConfig!.tick.armiesTickSeconds).toBe(60);
  });

  it("handles fetchWorldConfig failure gracefully", async () => {
    const client = createMockClient() as any;
    client.sql.fetchWorldConfig.mockRejectedValue(new Error("SQL timeout"));
    const state = await buildWorldState(client, "0xdeadbeef");

    // World state still works, gameConfig is undefined
    expect(state.entities).toBeDefined();
    expect(state.gameConfig).toBeUndefined();
  });
});
