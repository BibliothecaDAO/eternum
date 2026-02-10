import { describe, it, expect } from "vitest";
import { computeStamina, computeBalance, computeDepletionTime } from "@bibliothecadao/client";
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
    // Stamina is computed via tick-based regen (staminaUpdatedTick defaults to 0, fully regenerated)
    expect(army!.stamina).toBe(120);
    expect(army!.maxStamina).toBe(120);
    expect(army!.canExplore).toBe(true);
    expect(army!.canAttack).toBe(true);
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
    expect(realm!.guardSlots).toBeDefined();
    expect(realm!.guardSlots!.length).toBe(2);
    // Knight guard should have computed stamina (fully regenerated from tick 1000)
    expect(realm!.guardSlots![0].troopType).toBe("Knight");
    expect(realm!.guardSlots![0].count).toBe(20);
    expect(realm!.guardSlots![0].tier).toBe(1);
    expect(realm!.guardSlots![0].stamina).toBe(120); // fully regen'd
    expect(realm!.guardSlots![0].maxStamina).toBe(120);
    expect(realm!.guardSlots![0].isOnCooldown).toBe(false);
    // Paladin guard is on cooldown (cooldownEnd=9999999999 > now)
    expect(realm!.guardSlots![1].troopType).toBe("Paladin");
    expect(realm!.guardSlots![1].isOnCooldown).toBe(true);
    expect(realm!.guardStrength).toBe(500);
    // Buildings come from sql.fetchBuildingsByStructure, not realm view
    expect(client.sql.fetchBuildingsByStructure).toHaveBeenCalledWith(1);
    expect(realm!.buildings).toEqual([
      { category: "Farm", paused: false, position: { x: 10, y: 10 } },
      { category: "Wood", paused: false, position: { x: 11, y: 10 } },
      { category: "Knight T1", paused: true, position: { x: 12, y: 10 } },
    ]);
    // Resource balances come from sql.fetchResourceBalances, not realm view
    expect(client.sql.fetchResourceBalances).toHaveBeenCalledWith(1);
    expect(realm!.resourceBalances).toEqual([
      { resourceId: 1, name: "Stone", balance: 2400 },
      { resourceId: 3, name: "Wood", balance: 4000 },
    ]);
  });

  it("derives production rates from active buildings and gameConfig", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm).toBeDefined();
    // Wood building (cat 5) is active, maps to resource_type 3 (Wood)
    // realmOutputPerSecond for resource_type 3 is 0x3b9aca00 = 1000000000
    // With 1 active building: rate = 1000000000 / 1_000_000_000 = 1.0 per second
    expect(realm!.productionRates).toBeDefined();
    expect(realm!.productionRates!.length).toBeGreaterThan(0);
    const woodProd = realm!.productionRates!.find(p => p.name === "Wood");
    expect(woodProd).toBeDefined();
    expect(woodProd!.ratePerSecond).toBe(1);
  });

  it("computes distance from home for army entities", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const army = state.entities.find((e) => e.entityId === 100);
    expect(army).toBeDefined();
    // Army at (15, 25), structure at (10, 20) — should have a non-zero distance
    expect(army!.distanceFromHome).toBeDefined();
    expect(army!.distanceFromHome).toBeGreaterThan(0);
  });

  it("includes battle logs from SQL", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.recentBattles).toBeDefined();
    expect(state.recentBattles!.length).toBe(1);
    expect(state.recentBattles![0].winner).toBe("attacker");
    expect(state.recentBattles![0].attackerEntityId).toBe(100);
  });

  it("includes swap events from SQL", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.recentSwaps).toBeDefined();
    expect(state.recentSwaps!.length).toBe(1);
    expect(state.recentSwaps![0].resourceName).toBe("Wood");
    expect(state.recentSwaps![0].isBuy).toBe(true);
  });

  it("includes relic inventory from SQL", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.relics).toBeDefined();
    expect(state.relics!.length).toBe(1);
    expect(state.relics![0].relicId).toBe(1);
    expect(state.relics![0].bonusType).toBe("attack_bonus");
    expect(state.relics![0].isAttached).toBe(true);
  });

  it("includes nearby chests with distance", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.nearbyChests).toBeDefined();
    expect(state.nearbyChests!.length).toBe(2);
    expect(state.nearbyChests![0].distance).toBeGreaterThan(0);
  });

  it("includes market pools from SQL", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    expect(state.marketPools).toBeDefined();
    expect(state.marketPools!.length).toBe(1);
    expect(state.marketPools![0].price).toBe(2);
    expect(state.marketPools![0].lordsReserve).toBe(10000);
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

  // --- Phase 1: Stamina Enrichment ---

  it("computes current stamina using tick-based regen instead of stale value", async () => {
    const client = createMockClient() as any;
    // Explorer returns stale stamina with a lastUpdateTick far in the past
    client.view.explorer.mockResolvedValue({
      entityId: 100,
      explorerId: 100,
      troops: {
        totalTroops: 15,
        slots: [{ troopType: "Crossbowman", count: 15, tier: 1 }],
        strength: 200,
      },
      carriedResources: [{ resourceId: 1, name: "Wood", amount: 50 }],
      stamina: 20,
      staminaUpdatedTick: 1000,
      isInBattle: false,
    });

    const state = await buildWorldState(client, "0xdeadbeef");
    const army = state.entities.find((e) => e.entityId === 100);
    expect(army).toBeDefined();
    // With gainPerTick=20, a large tick gap should fully regenerate to maxStamina (120 for crossbowman)
    expect(army!.stamina).toBe(120);
    expect(army!.maxStamina).toBe(120);
    expect(army!.ticksUntilFullStamina).toBe(0);
    expect(army!.canExplore).toBe(true);
    expect(army!.canAttack).toBe(true);
  });

  it("sets canExplore and canAttack based on computed stamina vs config thresholds", async () => {
    const client = createMockClient() as any;
    // Set stamina so it's just above explore cost but below attack req
    // exploreCost=30, attackReq=50, maxStamina.crossbowman=120, gainPerTick=20
    // We want computed stamina to be 40: currentAmount=40, lastUpdateTick=currentTick (no regen)
    const currentTick = Math.floor(Date.now() / 1000 / 60); // armiesTickSeconds=60
    client.view.explorer.mockResolvedValue({
      entityId: 100,
      explorerId: 100,
      troops: {
        totalTroops: 15,
        slots: [{ troopType: "Crossbowman", count: 15, tier: 1 }],
        strength: 200,
      },
      carriedResources: [],
      stamina: 40,
      staminaUpdatedTick: currentTick,
      isInBattle: false,
    });

    const state = await buildWorldState(client, "0xdeadbeef");
    const army = state.entities.find((e) => e.entityId === 100);
    expect(army).toBeDefined();
    expect(army!.stamina).toBe(40);
    expect(army!.canExplore).toBe(true);  // 40 >= 30
    expect(army!.canAttack).toBe(false);   // 40 < 50
  });
});

describe("stamina enrichment (unit)", () => {
  it("computes current stamina from stale on-chain value using tick regen", () => {
    const result = computeStamina({
      currentAmount: 20,
      lastUpdateTick: 1770590000,
      currentTick: 1770592109,
      maxStamina: 120,
      regenPerTick: 20,
    });
    expect(result.current).toBe(120);
    expect(result.max).toBe(120);
    expect(result.ticksUntilFull).toBe(0);
  });

  it("caps stamina at max even with large tick gap", () => {
    const result = computeStamina({
      currentAmount: 0,
      lastUpdateTick: 0,
      currentTick: 999999999,
      maxStamina: 120,
      regenPerTick: 20,
    });
    expect(result.current).toBe(120);
  });
});

describe("resource production enrichment (unit)", () => {
  it("computes actual balance including pending production", () => {
    const result = computeBalance({
      rawBalance: 1308000000000,
      productionRate: 500000000,
      lastUpdatedAt: 1770590000,
      currentTick: 1770592109,
      isFood: true,
      outputAmountLeft: 0,
      buildingCount: 3,
      storageCapacityKg: 10000,
      storageUsedKg: 5000,
      resourceWeightKg: 1,
    });
    expect(result.balance).toBeGreaterThan(Math.floor(1308000000000 / 1_000_000_000));
  });

  it("computes depletion time for non-food resource", () => {
    const result = computeDepletionTime({
      outputAmountLeft: 1000000000000,
      productionRate: 500000000,
      lastUpdatedAt: 1770590000,
      currentTick: 1770590100,
      tickIntervalSeconds: 1,
      isFood: false,
    });
    expect(result.timeRemainingSeconds).toBeGreaterThan(0);
  });

  it("returns Infinity for food resources (never deplete)", () => {
    const result = computeDepletionTime({
      outputAmountLeft: 0,
      productionRate: 500000000,
      lastUpdatedAt: 1770590000,
      currentTick: 1770592109,
      tickIntervalSeconds: 1,
      isFood: true,
    });
    expect(result.timeRemainingSeconds).toBe(Infinity);
  });
});
