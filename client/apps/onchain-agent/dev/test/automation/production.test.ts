import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseGameConfig } from "@bibliothecadao/torii";
import { planProduction } from "../../../src/automation/production.js";

// ── Load real Torii fixture data ─────────────────────────────────────

const FIXTURES = join(import.meta.dirname, "fixtures");

const buildingCategoryRows = JSON.parse(readFileSync(join(FIXTURES, "building-category-config.json"), "utf-8"));
const factoryRows = JSON.parse(readFileSync(join(FIXTURES, "resource-factory-config.json"), "utf-8"));
const resourceListRows = JSON.parse(readFileSync(join(FIXTURES, "resource-list.json"), "utf-8"));
const buildingConfigRows = JSON.parse(readFileSync(join(FIXTURES, "building-config.json"), "utf-8"));

const gameConfig = parseGameConfig(buildingCategoryRows, factoryRows, resourceListRows, buildingConfigRows[0]);

// Resource IDs
const R = {
  Coal: 2,
  Wood: 3,
  Copper: 4,
  Ironwood: 5,
  Gold: 7,
  Mithral: 9,
  ColdIron: 11,
  Adamantine: 19,
  Dragonhide: 22,
  Labor: 23,
  Donkey: 25,
  Knight: 26,
  KnightT2: 27,
  KnightT3: 28,
  Crossbowman: 29,
  CrossbowmanT2: 30,
  CrossbowmanT3: 31,
  Paladin: 32,
  PaladinT2: 33,
  PaladinT3: 34,
  Wheat: 35,
  Essence: 38,
} as const;

// BuildingType values (resource buildings = resource_id + 2, troop buildings are separate)
const B = {
  Coal: 4,
  Wood: 5,
  Copper: 6,
  Ironwood: 7,
  Gold: 9,
  Mithral: 11,
  ColdIron: 13,
  Adamantine: 21,
  Dragonhide: 24,
  KnightT1: 28,
  KnightT2: 29,
  KnightT3: 30,
  CrossbowmanT1: 31,
  CrossbowmanT2: 32,
  CrossbowmanT3: 33,
  PaladinT1: 34,
  PaladinT2: 35,
  PaladinT3: 36,
} as const;

/** Helper: create buildingCounts map from entries */
function buildings(...entries: [number, number][]): Map<number, number> {
  return new Map(entries);
}

// ── Fixture sanity checks ────────────────────────────────────────────

describe("gameConfig fixture", () => {
  it("parsed building costs from real Torii data", () => {
    expect(Object.keys(gameConfig.buildingCosts).length).toBeGreaterThan(0);
  });

  it("parsed resource factories from real Torii data", () => {
    expect(Object.keys(gameConfig.resourceFactories).length).toBeGreaterThan(0);
  });

  it("has correct building cost scale", () => {
    expect(gameConfig.buildingBaseCostPercentIncrease).toBe(1000);
  });

  it("has complex inputs for Wood (resource 3)", () => {
    const factory = gameConfig.resourceFactories[R.Wood];
    expect(factory).toBeDefined();
    expect(factory.complexInputs.length).toBeGreaterThan(0);
    expect(factory.outputPerComplexInput).toBeGreaterThan(0);
  });

  it("has production rates parsed correctly", () => {
    const factory = gameConfig.resourceFactories[R.Wood];
    expect(factory.realmOutputPerSecond).toBe(1); // 1 per second
    expect(factory.villageOutputPerSecond).toBe(0.5);
  });

  it("has troop production rates", () => {
    const factory = gameConfig.resourceFactories[R.Knight];
    expect(factory.realmOutputPerSecond).toBe(5); // 5 per second
    expect(factory.villageOutputPerSecond).toBe(2.5);
  });
});

// ── Budget-limited production ────────────────────────────────────────

describe("planProduction — budget-limited cycles", () => {
  it("produces wood cycles limited only by input budget (no rate cap)", () => {
    const balances = new Map([
      [R.Wheat, 10000],
      [R.Coal, 1000],
      [R.Copper, 1000],
    ]);
    const plan = planProduction(balances, buildings([B.Wood, 1]), "Paladin", gameConfig, 60);

    const woodCall = plan.calls.find((c) => c.resourceId === R.Wood && c.method === "complex");
    expect(woodCall).toBeDefined();
    // Should be limited by 90% of Coal or Copper (whichever is bottleneck), not by rate
    expect(woodCall!.cycles).toBeGreaterThan(60);
  });

  it("limits cycles to 90% of bottleneck input", () => {
    const balances = new Map([
      [R.Wheat, 100],
      [R.Coal, 5],
      [R.Copper, 1000],
    ]);
    const plan = planProduction(balances, buildings([B.Wood, 1]), "Paladin", gameConfig, 60);

    const woodCall = plan.calls.find((c) => c.resourceId === R.Wood && c.method === "complex");
    expect(woodCall).toBeDefined();
    expect(woodCall!.cycles).toBe(20);
  });

  it("building count does not cap cycles (only affects rate, which we ignore)", () => {
    const balances = new Map([
      [R.Wheat, 100000],
      [R.Coal, 100000],
      [R.Copper, 100000],
    ]);
    const plan1 = planProduction(balances, buildings([B.Wood, 1]), "Paladin", gameConfig, 60);
    const plan3 = planProduction(new Map(balances), buildings([B.Wood, 3]), "Paladin", gameConfig, 60);

    const wood1 = plan1.calls.find((c) => c.resourceId === R.Wood && c.method === "complex");
    const wood3 = plan3.calls.find((c) => c.resourceId === R.Wood && c.method === "complex");
    expect(wood1).toBeDefined();
    expect(wood3).toBeDefined();
    expect(wood1!.cycles).toBe(wood3!.cycles);
  });
});

// ── Dependency ordering ──────────────────────────────────────────────

describe("planProduction — dependency ordering", () => {
  it("produces T1 resources before troops", () => {
    const balances = new Map([
      [R.Wheat, 1000],
      [R.Coal, 100],
      [R.Copper, 100],
      [R.Wood, 100],
    ]);
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1], [B.KnightT1, 1]);
    const plan = planProduction(balances, bc, "Knight", gameConfig, 60);

    const callOrder = plan.calls.map((c) => c.resourceId);
    const woodIdx = callOrder.indexOf(R.Wood);
    const knightIdx = callOrder.indexOf(R.Knight);
    expect(woodIdx).toBeGreaterThanOrEqual(0);
    expect(knightIdx).toBeGreaterThan(woodIdx);
  });

  it("consumes T1 resources from budget so troops see reduced availability", () => {
    const balances = new Map([
      [R.Wheat, 200],
      [R.Coal, 50],
      [R.Copper, 50],
    ]);
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1], [B.PaladinT1, 1]);
    const plan = planProduction(balances, bc, "Paladin", gameConfig, 60);

    const wheatConsumed = plan.consumed.get(R.Wheat) ?? 0;
    expect(wheatConsumed).toBeLessThanOrEqual(180); // 90% of 200
  });
});

// ── Building requirement ─────────────────────────────────────────────

describe("planProduction — building checks", () => {
  it("skips resources without corresponding building", () => {
    const balances = new Map([
      [R.Wheat, 1000],
      [R.Coal, 100],
      [R.Copper, 100],
    ]);
    const plan = planProduction(balances, buildings([B.Wood, 1]), "Paladin", gameConfig, 60);

    const coalCall = plan.calls.find((c) => c.resourceId === R.Coal);
    const copperCall = plan.calls.find((c) => c.resourceId === R.Copper);
    expect(coalCall).toBeUndefined();
    expect(copperCall).toBeUndefined();
  });

  it("produces T2 resources when building exists", () => {
    const balances = new Map([
      [R.Wheat, 1000],
      [R.Coal, 100],
      [R.Copper, 100],
    ]);
    const plan = planProduction(balances, buildings([B.ColdIron, 1]), "Knight", gameConfig, 60);

    const coldIronCall = plan.calls.find((c) => c.resourceId === R.ColdIron);
    expect(coldIronCall).toBeDefined();
    expect(coldIronCall!.cycles).toBeGreaterThan(0);
  });

  it("produces T2 and T3 troops when buildings exist", () => {
    const balances = new Map([
      [R.Wheat, 5000],
      [R.Coal, 500],
      [R.Copper, 500],
      [R.Wood, 500],
      [R.Gold, 200],
      [R.Paladin, 500],
      [R.PaladinT2, 500],
      [R.Dragonhide, 200],
      [R.Essence, 100],
    ]);
    const bc = buildings([B.PaladinT1, 1], [B.PaladinT2, 1], [B.PaladinT3, 1]);
    const plan = planProduction(balances, bc, "Paladin", gameConfig, 60);

    const t2Call = plan.calls.find((c) => c.resourceId === R.PaladinT2);
    const t3Call = plan.calls.find((c) => c.resourceId === R.PaladinT3);
    expect(t2Call).toBeDefined();
    expect(t3Call).toBeDefined();
  });
});

// ── Donkey production ────────────────────────────────────────────────

describe("planProduction — donkey production", () => {
  it("produces donkeys when donkey building exists and inputs available", () => {
    const balances = new Map([
      [R.Wheat, 100000],
      [R.Coal, 10000],
      [R.Copper, 10000],
      [R.Wood, 10000],
    ]);
    // Donkey building type = 27 (resource ID 25 + offset 2)
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1], [B.PaladinT1, 1], [27, 1]);
    const plan = planProduction(balances, bc, "Paladin", gameConfig, 60);

    const donkeyCall = plan.calls.find((c) => c.resourceId === R.Donkey);
    expect(donkeyCall).toBeDefined();
    expect(donkeyCall!.cycles).toBeGreaterThan(0);
  });

  it("skips donkeys when no donkey building exists", () => {
    const balances = new Map([
      [R.Wheat, 100000],
      [R.Coal, 10000],
      [R.Copper, 10000],
      [R.Wood, 10000],
    ]);
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1]);
    const plan = planProduction(balances, bc, "Paladin", gameConfig, 60);

    const donkeyCall = plan.calls.find((c) => c.resourceId === R.Donkey);
    expect(donkeyCall).toBeUndefined();
  });
});

// ── Simple fallback ──────────────────────────────────────────────────

describe("planProduction — simple fallback", () => {
  it("uses simple recipes when complex inputs exhausted", () => {
    const balances = new Map([
      [R.Wheat, 1000],
      [R.Labor, 500],
    ]);
    const plan = planProduction(balances, buildings([B.Wood, 1]), "Paladin", gameConfig, 60);

    const simpleWood = plan.calls.find((c) => c.resourceId === R.Wood && c.method === "simple");
    expect(simpleWood).toBeDefined();
    expect(simpleWood!.cycles).toBeGreaterThan(0);
  });

  it("complex runs first, simple uses remaining budget", () => {
    const balances = new Map([
      [R.Wheat, 1000],
      [R.Coal, 50],
      [R.Copper, 50],
      [R.Labor, 500],
    ]);
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1]);
    const plan = planProduction(balances, bc, "Paladin", gameConfig, 60);

    const complexCalls = plan.calls.filter((c) => c.method === "complex");
    const simpleCalls = plan.calls.filter((c) => c.method === "simple");
    expect(complexCalls.length).toBeGreaterThan(0);
    expect(simpleCalls.length).toBeGreaterThan(0);
  });
});

// ── Dual method per resource ────────────────────────────────────────

describe("planProduction — dual method per resource", () => {
  it("runs both complex and simple for the same resource in one pass", () => {
    const balances = new Map([
      [R.Wheat, 1000],
      [R.Coal, 50],
      [R.Copper, 50],
      [R.Labor, 500],
    ]);
    const plan = planProduction(balances, buildings([B.Wood, 1]), "Paladin", gameConfig, 60);

    const complexWood = plan.calls.find((c) => c.resourceId === R.Wood && c.method === "complex");
    const simpleWood = plan.calls.find((c) => c.resourceId === R.Wood && c.method === "simple");
    expect(complexWood).toBeDefined();
    expect(simpleWood).toBeDefined();
  });

  it("runs simple for T2 resources when available", () => {
    const balances = new Map([
      [R.Wheat, 1000],
      [R.Labor, 500],
    ]);
    const plan = planProduction(balances, buildings([B.ColdIron, 1]), "Knight", gameConfig, 60);

    const simpleColdIron = plan.calls.find((c) => c.resourceId === R.ColdIron && c.method === "simple");
    const factory = gameConfig.resourceFactories[R.ColdIron];
    if (factory && factory.simpleInputs.length > 0 && factory.outputPerSimpleInput > 0) {
      expect(simpleColdIron).toBeDefined();
    }
  });
});

// ── Edge cases ───────────────────────────────────────────────────────

describe("planProduction — edge cases", () => {
  it("returns empty plan with no balances", () => {
    const plan = planProduction(new Map(), buildings([B.Wood, 1]), "Paladin", gameConfig);
    expect(plan.calls).toHaveLength(0);
  });

  it("returns empty plan with no buildings", () => {
    const balances = new Map([[R.Wheat, 10000]]);
    const plan = planProduction(balances, new Map(), "Paladin", gameConfig);
    expect(plan.calls).toHaveLength(0);
  });
});
