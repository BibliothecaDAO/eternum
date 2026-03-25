import { describe, it, expect } from "vitest";
import { nextPlan, type RealmState, type BuildingPopulationInfo } from "../../../src/automation/runner.js";
import { buildOrderForBiome } from "../../../src/automation/build-order.js";

// Population info matching real game data
const POP_INFO: Record<number, BuildingPopulationInfo> = {
  1: { populationCost: 0, capacityGrant: 6 }, // WorkersHut
  4: { populationCost: 2, capacityGrant: 0 }, // Coal
  5: { populationCost: 2, capacityGrant: 0 }, // Wood
  6: { populationCost: 2, capacityGrant: 0 }, // Copper
  7: { populationCost: 2, capacityGrant: 0 }, // Ironwood
  9: { populationCost: 2, capacityGrant: 0 }, // Gold
  11: { populationCost: 2, capacityGrant: 0 }, // Mithral
  13: { populationCost: 2, capacityGrant: 0 }, // ColdIron
  21: { populationCost: 2, capacityGrant: 0 }, // Adamantine
  24: { populationCost: 2, capacityGrant: 0 }, // Dragonhide
  28: { populationCost: 3, capacityGrant: 0 }, // KnightT1
  29: { populationCost: 3, capacityGrant: 0 }, // KnightT2
  30: { populationCost: 3, capacityGrant: 0 }, // KnightT3
  31: { populationCost: 3, capacityGrant: 0 }, // CrossbowmanT1
  32: { populationCost: 3, capacityGrant: 0 }, // CrossbowmanT2
  33: { populationCost: 3, capacityGrant: 0 }, // CrossbowmanT3
  34: { populationCost: 3, capacityGrant: 0 }, // PaladinT1
  35: { populationCost: 3, capacityGrant: 0 }, // PaladinT2
  36: { populationCost: 3, capacityGrant: 0 }, // PaladinT3
  37: { populationCost: 1, capacityGrant: 0 }, // Wheat
};

function makeState(overrides: Partial<RealmState> = {}): RealmState {
  return {
    biome: 11, // Grassland → Paladin
    level: 0, // Settlement (6 slots)
    buildingCounts: new Map(),
    ...overrides,
  };
}

describe("nextPlan — empty realm", () => {
  it("plans to fill all available slots in one tick", () => {
    const plan = nextPlan(makeState(), POP_INFO);
    // Empty Settlement: 6 slots. Should plan multiple builds.
    expect(plan.builds.length).toBeGreaterThan(1);
    // First build should be WheatFarm (base pop capacity is 6)
    expect(plan.builds[0].step.label).toBe("WheatFarm");
  });
});

describe("nextPlan — partial progress", () => {
  it("plans remaining builds to fill slots", () => {
    const state = makeState({
      buildingCounts: new Map([
        [37, 1], // WheatFarm built
        [1, 1], // WorkersHut built
      ]),
    });
    const plan = nextPlan(state, POP_INFO);
    // 2/6 slots used, should plan to fill remaining 4
    expect(plan.builds.length).toBeGreaterThan(0);
    expect(plan.builds[0].step.label).toBe("WoodMill");
  });
});

describe("nextPlan — slot limit triggers upgrade", () => {
  it("returns upgrade when Settlement is full", () => {
    const state = makeState({
      level: 0,
      buildingCounts: new Map([
        [37, 1],
        [1, 1],
        [4, 1],
        [6, 1],
        [5, 1],
        [34, 1],
      ]),
    });

    const plan = nextPlan(state, POP_INFO);
    expect(plan.upgrade).not.toBeNull();
    expect(plan.upgrade!.fromLevel).toBe(0);
    expect(plan.upgrade!.toName).toBe("City");
  });

  it("returns idle when Empire is full", () => {
    const state = makeState({
      level: 3,
      buildingCounts: new Map([[37, 60]]),
    });

    const plan = nextPlan(state, POP_INFO);
    expect(plan.idle).toBeTruthy();
    expect(plan.builds.length).toBe(0);
  });
});

describe("nextPlan — fills all slots", () => {
  it("plans builds up to the slot limit", () => {
    // Empty Settlement, 6 slots available
    const plan = nextPlan(makeState(), POP_INFO);
    // Should plan exactly 6 builds (filling all slots)
    expect(plan.builds.length).toBe(6);
    // Should then need an upgrade since all slots are filled
    expect(plan.upgrade).not.toBeNull();
  });

  it("plans multiple builds for a City with room", () => {
    const state = makeState({
      level: 1, // City (18 slots)
      buildingCounts: new Map([
        [37, 1],
        [1, 1],
        [4, 1],
        [6, 1],
        [5, 1],
      ]),
    });
    const plan = nextPlan(state, POP_INFO);
    // 5/18 slots used, 13 remaining — should plan many builds
    expect(plan.builds.length).toBeGreaterThan(5);
  });
});

describe("nextPlan — population bottleneck injects WorkersHut", () => {
  it("injects WorkersHuts when population is full", () => {
    const state = makeState({
      level: 1,
      buildingCounts: new Map([
        [37, 1], // Wheat — popCost=1
        [4, 1], // Coal — popCost=2
        [6, 1], // Copper — popCost=2
        [5, 1], // Wood — popCost=2
        // popUsed=7, popCap=6 (base, no WH) → next 2-cost build overflows
      ]),
    });

    const plan = nextPlan(state, POP_INFO);
    // The runner should inject a WorkersHut before the next resource building
    const labels = plan.builds.map((b) => b.step.label);
    expect(labels).toContain("WorkersHut");
    // The first injected WH should come before any new resource building
    const whIdx = labels.indexOf("WorkersHut");
    expect(plan.builds[whIdx].injectedForPopulation).toBe(true);
  });
});

describe("nextPlan — cycling", () => {
  it("plans builds for a Kingdom with partial progress", () => {
    const order = buildOrderForBiome(11);
    // Build only the first 13 steps (Settlement + some City)
    const counts = new Map<number, number>();
    for (const step of order.steps.slice(0, 13)) {
      counts.set(step.building, (counts.get(step.building) ?? 0) + 1);
    }

    // Kingdom (36 slots), 13 buildings built — 23 slots left
    const state = makeState({ level: 2, buildingCounts: counts });
    const plan = nextPlan(state, POP_INFO);

    // Should plan builds into the remaining 23 slots (including injected WorkersHuts)
    expect(plan.builds.length).toBeGreaterThan(10);
    // Total (existing + planned) must not exceed max slots (36 for Kingdom)
    expect(plan.builds.length + 13).toBeLessThanOrEqual(36);
  });
});

describe("nextPlan — different biomes", () => {
  it("Crossbowman path for ocean biome", () => {
    const state = makeState({
      biome: 2,
      level: 1,
      buildingCounts: new Map([
        [37, 1],
        [1, 2],
        [4, 1],
        [6, 1],
        [5, 1],
      ]),
    });
    const plan = nextPlan(state, POP_INFO);
    // After foundation, first path-specific build should be CrossbowmanT1
    const labels = plan.builds.map((b) => b.step.label);
    expect(labels).toContain("CrossbowmanT1");
  });
});
