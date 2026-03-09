import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseGameConfig } from "@bibliothecadao/torii";
import { planProduction, computeSmartWeights, type BuildingTarget } from "../../../src/automation/production.js";

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
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1]);
    const plan = planProduction(balances, bc, "Paladin", gameConfig, 60);

    const woodCall = plan.calls.find((c) => c.resourceId === R.Wood && c.method === "complex");
    expect(woodCall).toBeDefined();
    // Should be limited by weighted share of Coal or Copper, not by rate
    expect(woodCall!.cycles).toBeGreaterThan(0);
  });

  it("limits cycles by weighted share of bottleneck input", () => {
    const balances = new Map([
      [R.Wheat, 100],
      [R.Coal, 5],
      [R.Copper, 1000],
    ]);
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1]);
    const plan = planProduction(balances, bc, "Paladin", gameConfig, 60);

    const woodCall = plan.calls.find((c) => c.resourceId === R.Wood && c.method === "complex");
    expect(woodCall).toBeDefined();
    // Coal=5, weight=30% → weightedLimit=floor(5*30/100)=1, Coal input per cycle=0.225 → floor(1/0.225)=4
    // But also constrained by 90% budget: floor(5*90/100)=4 remaining for Coal
    // permitted = min(4, 1) = 1 → cycles = floor(1/0.225) = 4
    expect(woodCall!.cycles).toBeGreaterThan(0);
    expect(woodCall!.cycles).toBeLessThanOrEqual(20); // less than old unweighted value
  });

  it("building count does not cap cycles (only affects rate, which we ignore)", () => {
    const balances = new Map([
      [R.Wheat, 100000],
      [R.Coal, 100000],
      [R.Copper, 100000],
    ]);
    const bc1 = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1]);
    const bc3 = buildings([B.Wood, 3], [B.Coal, 1], [B.Copper, 1]);
    const plan1 = planProduction(balances, bc1, "Paladin", gameConfig, 60);
    const plan3 = planProduction(new Map(balances), bc3, "Paladin", gameConfig, 60);

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
    // Keep T1 resource inputs small so they don't exhaust the Wheat/Copper
    // budget before Knight production runs.
    const balances = new Map([
      [R.Wheat, 10000],
      [R.Coal, 10],
      [R.Copper, 10000],
      [R.Wood, 10],
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
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1]);
    const plan = planProduction(balances, bc, "Paladin", gameConfig, 60);

    // Paladin troop should not be produced without PaladinT1 building
    const paladinCall = plan.calls.find((c) => c.resourceId === R.Paladin);
    expect(paladinCall).toBeUndefined();
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
    // Only include T2 and T3 buildings (no T1) so T1 doesn't exhaust
    // shared inputs. Keep Paladin balance small so T2 is bottlenecked
    // by Paladin (not Essence), leaving Essence available for T3.
    const balances = new Map([
      [R.Wheat, 5000000],
      [R.Copper, 500000],
      [R.Gold, 500000],
      [R.Paladin, 100],
      [R.PaladinT2, 5000000],
      [R.Dragonhide, 500000],
      [R.Essence, 500000],
    ]);
    const bc = buildings([B.PaladinT2, 1], [B.PaladinT3, 1]);
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

  it("simple (labor) runs when T1 is incomplete", () => {
    // T1 incomplete (only Wood) → laborToResource=5%, resourceToResource=0%
    // So only simple (labor) production runs, complex is skipped
    const balances = new Map([
      [R.Wheat, 1000],
      [R.Labor, 500],
    ]);
    const bc = buildings([B.Wood, 1]);
    const plan = planProduction(balances, bc, "Paladin", gameConfig, 60);

    const simpleCalls = plan.calls.filter((c) => c.method === "simple");
    expect(simpleCalls.length).toBeGreaterThan(0);
    // Complex should be skipped (zero weight for T1 incomplete)
    const complexCalls = plan.calls.filter((c) => c.method === "complex");
    expect(complexCalls.length).toBe(0);
  });
});

// ── Dual method per resource ────────────────────────────────────────

describe("planProduction — dual method per resource", () => {
  it("runs only complex when T1 is complete (labor weight is 0)", () => {
    const balances = new Map([
      [R.Wheat, 1000],
      [R.Coal, 50],
      [R.Copper, 50],
      [R.Labor, 500],
    ]);
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1]);
    const plan = planProduction(balances, bc, "Paladin", gameConfig, 60);

    const complexWood = plan.calls.find((c) => c.resourceId === R.Wood && c.method === "complex");
    expect(complexWood).toBeDefined();
    // Simple has 0 weight when T1 is complete → skipped
    const simpleWood = plan.calls.find((c) => c.resourceId === R.Wood && c.method === "simple");
    expect(simpleWood).toBeUndefined();
  });

  it("runs complex for T2 resources when building and inputs available", () => {
    const balances = new Map([
      [R.Wheat, 10000],
      [R.Coal, 1000],
      [R.Copper, 1000],
    ]);
    const bc = buildings([B.ColdIron, 1]);
    const plan = planProduction(balances, bc, "Knight", gameConfig, 60);

    const complexColdIron = plan.calls.find((c) => c.resourceId === R.ColdIron && c.method === "complex");
    expect(complexColdIron).toBeDefined();
    expect(complexColdIron!.cycles).toBeGreaterThan(0);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────

// ── Smart weight computation ─────────────────────────────────────────

describe("computeSmartWeights", () => {
  it("returns 5% labor-only for T1 when T1 is incomplete", () => {
    const weights = computeSmartWeights(buildings([B.Wood, 1]), "Paladin");
    const woodWeight = weights.get(R.Wood);
    expect(woodWeight).toBeDefined();
    expect(woodWeight!.laborToResource).toBe(5);
    expect(woodWeight!.resourceToResource).toBe(0);
  });

  it("returns 30% resource for T1 when T1 complete, no higher tiers", () => {
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1]);
    const weights = computeSmartWeights(bc, "Paladin");
    expect(weights.get(R.Wood)!.resourceToResource).toBe(30);
    expect(weights.get(R.Coal)!.resourceToResource).toBe(30);
    expect(weights.get(R.Copper)!.resourceToResource).toBe(30);
  });

  it("returns adjusted T1 weights when higher tiers present", () => {
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1], [B.PaladinT1, 1]);
    const weights = computeSmartWeights(bc, "Paladin");
    expect(weights.get(R.Wood)!.resourceToResource).toBe(20);
    expect(weights.get(R.Coal)!.resourceToResource).toBe(20);
    expect(weights.get(R.Copper)!.resourceToResource).toBe(30);
  });

  it("returns troop weights scaled by highest tier", () => {
    // T1 only → 30%
    let bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1], [B.PaladinT1, 1]);
    let weights = computeSmartWeights(bc, "Paladin");
    expect(weights.get(R.Paladin)!.resourceToResource).toBe(30);

    // T2 exists → T2=30%, T1=10%
    bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1], [B.PaladinT1, 1], [B.PaladinT2, 1]);
    weights = computeSmartWeights(bc, "Paladin");
    expect(weights.get(R.PaladinT2)!.resourceToResource).toBe(30);
    expect(weights.get(R.Paladin)!.resourceToResource).toBe(10);

    // T3 exists → T3=50%, T2=30%, T1=10%
    bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1], [B.PaladinT1, 1], [B.PaladinT2, 1], [B.PaladinT3, 1]);
    weights = computeSmartWeights(bc, "Paladin");
    expect(weights.get(R.PaladinT3)!.resourceToResource).toBe(50);
    expect(weights.get(R.PaladinT2)!.resourceToResource).toBe(30);
    expect(weights.get(R.Paladin)!.resourceToResource).toBe(10);
  });

  it("returns 0 weights for resources without buildings", () => {
    const bc = buildings([B.Wood, 1]);
    const weights = computeSmartWeights(bc, "Paladin");
    expect(weights.has(R.Coal)).toBe(false);
  });

  it("includes donkey weight when donkey building exists", () => {
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1], [27, 1]); // 27 = donkey building
    const weights = computeSmartWeights(bc, "Paladin");
    expect(weights.get(R.Donkey)!.resourceToResource).toBe(10);
  });
});

// ── Smart weights integration ────────────────────────────────────────

describe("planProduction — smart weights", () => {
  it("limits T1 to labor-only when T1 is incomplete", () => {
    // Only Wood building, no Coal or Copper → T1 incomplete → 5% labor only
    const balances = new Map([
      [R.Wheat, 10000],
      [R.Labor, 5000],
      [R.Coal, 1000],
      [R.Copper, 1000],
    ]);
    const plan = planProduction(balances, buildings([B.Wood, 1]), "Paladin", gameConfig);

    // Should only have simple (labor) calls for Wood, no complex
    const complexWood = plan.calls.find((c) => c.resourceId === R.Wood && c.method === "complex");
    const simpleWood = plan.calls.find((c) => c.resourceId === R.Wood && c.method === "simple");
    expect(complexWood).toBeUndefined();
    expect(simpleWood).toBeDefined();
  });

  it("allows 30% resource when T1 is complete with no higher tiers", () => {
    const balances = new Map([
      [R.Wheat, 100000],
      [R.Coal, 10000],
      [R.Copper, 10000],
    ]);
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1]);
    const plan = planProduction(balances, bc, "Paladin", gameConfig);

    const woodCall = plan.calls.find((c) => c.resourceId === R.Wood && c.method === "complex");
    expect(woodCall).toBeDefined();
    expect(woodCall!.cycles).toBeGreaterThan(0);
  });

  it("produces troops at appropriate weight when higher tiers present", () => {
    const balances = new Map([
      [R.Wheat, 100000],
      [R.Coal, 10000],
      [R.Copper, 100000],
      [R.Wood, 10000],
    ]);
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1], [B.PaladinT1, 1]);
    const plan = planProduction(balances, bc, "Paladin", gameConfig);

    const troopCall = plan.calls.find((c) => c.resourceId === R.Paladin);
    expect(troopCall).toBeDefined();
    expect(troopCall!.cycles).toBeGreaterThan(0);
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

// ── Building targets ──────────────────────────────────────────────────

describe("planProduction — building targets", () => {
  it("includes affordable buildings in the plan", () => {
    const balances = new Map([
      [R.Wheat, 100000],
      [R.Coal, 10000],
      [R.Copper, 10000],
      [R.Wood, 10000],
      [R.Essence, 5000],
      [R.Labor, 50000],
    ]);
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1]);
    const buildingTargets: BuildingTarget[] = [
      {
        buildingType: B.PaladinT1,
        label: "PaladinT1",
        costs: [
          { resource: R.Wood, amount: 100 },
          { resource: R.Copper, amount: 50 },
        ],
        useSimple: false,
        slot: { directions: [1, 2] },
      },
    ];

    const plan = planProduction(balances, bc, "Paladin", gameConfig, 60, false, buildingTargets);

    expect(plan.affordableBuilds).toHaveLength(1);
    expect(plan.affordableBuilds[0].label).toBe("PaladinT1");
  });

  it("skips buildings when budget is exhausted", () => {
    const balances = new Map([
      [R.Wood, 10],
      [R.Copper, 10],
    ]);
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1]);
    const buildingTargets: BuildingTarget[] = [
      {
        buildingType: B.PaladinT1,
        label: "PaladinT1",
        costs: [
          { resource: R.Wood, amount: 100 },
          { resource: R.Copper, amount: 50 },
        ],
        useSimple: false,
        slot: { directions: [1, 2] },
      },
    ];

    const plan = planProduction(balances, bc, "Paladin", gameConfig, 60, false, buildingTargets);

    expect(plan.affordableBuilds).toHaveLength(0);
    expect(plan.skippedBuilds).toHaveLength(1);
    expect(plan.skippedBuilds[0].reason).toBe("Insufficient budget");
  });

  it("buildings and production share the same budget", () => {
    // Use Coal as the bottleneck input for Wood production.
    // Coal=500, 90% budget=450, weight=20% of 500=100 → permitted=min(450,100)=100
    // With building consuming 80 Coal → budget=370, permitted=min(370,100)=100 (same)
    // Instead, use a scenario where budget is the binding constraint:
    // Coal=100, 90% budget=90, weight=20% of 100=20 → permitted=min(90,20)=20
    // With building consuming 15 Coal → budget=75, permitted=min(75,20)=20 (still same)
    // We need the building to consume enough to push budget below weighted limit.
    // Coal=100, budget=90, weight=20→20. Building costs 80 Coal → budget=10, permitted=min(10,20)=10
    const balances = new Map([
      [R.Wheat, 100000],
      [R.Coal, 100],
      [R.Copper, 100000],
      [R.Wood, 100000],
    ]);
    const bc = buildings([B.Wood, 1], [B.Coal, 1], [B.Copper, 1], [B.PaladinT1, 1]);

    // Without building
    const planNoBuild = planProduction(balances, bc, "Paladin", gameConfig, 60, false, []);
    const coalConsumedNoBuild = planNoBuild.consumed.get(R.Coal) ?? 0;

    // With building that costs 80 Coal — eats into the shared budget
    const buildingTargets: BuildingTarget[] = [
      {
        buildingType: B.Coal,
        label: "CoalMine",
        costs: [{ resource: R.Coal, amount: 80 }],
        useSimple: false,
        slot: { directions: [1] },
      },
    ];
    const planWithBuild = planProduction(new Map(balances), bc, "Paladin", gameConfig, 60, false, buildingTargets);
    const coalConsumedByProductionWithBuild = (planWithBuild.consumed.get(R.Coal) ?? 0) - 80;

    // Production should consume less Coal when building already took 80 from the budget
    expect(coalConsumedByProductionWithBuild).toBeLessThan(coalConsumedNoBuild);
    expect(planWithBuild.affordableBuilds).toHaveLength(1);
  });

  it("returns empty affordableBuilds when no buildingTargets provided", () => {
    const balances = new Map([[R.Wheat, 1000]]);
    const plan = planProduction(balances, new Map(), "Paladin", gameConfig);
    expect(plan.affordableBuilds).toHaveLength(0);
    expect(plan.skippedBuilds).toHaveLength(0);
  });
});
