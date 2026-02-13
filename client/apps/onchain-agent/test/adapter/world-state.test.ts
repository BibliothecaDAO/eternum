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

  it("uses structure category names from numeric types", async () => {
    const client = createMockClient() as any;
    const state = await buildWorldState(client, "0xdeadbeef");

    const realm = state.entities.find((e) => e.entityId === 1);
    expect(realm!.structureType).toBe("Realm"); // structure_type: 1

    const mine = state.entities.find((e) => e.entityId === 3);
    expect(mine!.structureType).toBe("Mine"); // structure_type: 4
  });
});
