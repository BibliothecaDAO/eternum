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

  it("calls all view methods in parallel", async () => {
    const client = createMockClient() as any;
    await buildWorldState(client, "0xdeadbeef");

    expect(client.view.player).toHaveBeenCalledWith("0xdeadbeef");
    expect(client.view.mapArea).toHaveBeenCalledWith({ x: 10, y: 20, radius: 50 });
    expect(client.view.market).toHaveBeenCalled();
    expect(client.view.leaderboard).toHaveBeenCalledWith({ limit: 10 });
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
    expect(realm!.buildings).toEqual([
      { category: "Farm", position: { x: 1, y: 2 } },
      { category: "Barracks", position: { x: 3, y: 4 } },
    ]);
    expect(realm!.resourceBalances).toEqual([
      { resourceId: 1, name: "Wood", balance: 250 },
      { resourceId: 2, name: "Stone", balance: 150 },
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
});
