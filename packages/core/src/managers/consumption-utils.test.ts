import { describe, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import { aggregateConsumptionPerSecond } from "./consumption-utils";

const makeRecipes = () => ({
  complexSystemResourceInputs: {
    [ResourcesIds.Knight]: [
      { resource: ResourcesIds.Coal, amount: 10 },
      { resource: ResourcesIds.Copper, amount: 4 },
    ],
    [ResourcesIds.Paladin]: [
      { resource: ResourcesIds.Coal, amount: 5 },
      { resource: ResourcesIds.Wood, amount: 6 },
    ],
  },
  simpleSystemResourceInputs: {
    [ResourcesIds.Knight]: [{ resource: ResourcesIds.Labor, amount: 20 }],
    [ResourcesIds.Paladin]: [{ resource: ResourcesIds.Labor, amount: 12 }],
  },
});

describe("aggregateConsumptionPerSecond", () => {
  it("returns an empty map when no produced resources are provided", () => {
    const result = aggregateConsumptionPerSecond([], {}, { recipes: makeRecipes() });
    expect(result.size).toBe(0);
  });

  it("skips resources whose slider percentages are zero or missing", () => {
    const recipes = makeRecipes();
    const result = aggregateConsumptionPerSecond(
      [ResourcesIds.Knight, ResourcesIds.Paladin],
      {
        [ResourcesIds.Knight]: { resourceToResource: 0, laborToResource: 0 },
      },
      { recipes },
    );
    expect(result.size).toBe(0);
  });

  it("sums complex and labor recipe inputs into per-second consumption", () => {
    const recipes = makeRecipes();
    // With maxAllocationPercent=90, a slider value of 90 means ratio=1.
    // cycleSeconds=60, so per-cycle `amount` divided by 60 gives per-second.
    // Knight: resource slider 90 -> coal 10/cycle, copper 4/cycle.
    //         labor slider 90 -> labor 20/cycle.
    // Paladin: resource slider 45 -> coal 2.5/cycle, wood 3/cycle.
    //          labor slider 0.
    const result = aggregateConsumptionPerSecond(
      [ResourcesIds.Knight, ResourcesIds.Paladin],
      {
        [ResourcesIds.Knight]: { resourceToResource: 90, laborToResource: 90 },
        [ResourcesIds.Paladin]: { resourceToResource: 45, laborToResource: 0 },
      },
      { recipes, maxAllocationPercent: 90, cycleSeconds: 60 },
    );

    expect(result.get(ResourcesIds.Coal)).toBeCloseTo((10 + 2.5) / 60, 10);
    expect(result.get(ResourcesIds.Copper)).toBeCloseTo(4 / 60, 10);
    expect(result.get(ResourcesIds.Wood)).toBeCloseTo(3 / 60, 10);
    expect(result.get(ResourcesIds.Labor)).toBeCloseTo(20 / 60, 10);
  });

  it("multiplies out to the original per-cycle values when caller scales by cycleSeconds", () => {
    const recipes = makeRecipes();
    const perSecond = aggregateConsumptionPerSecond(
      [ResourcesIds.Knight],
      { [ResourcesIds.Knight]: { resourceToResource: 45, laborToResource: 0 } },
      { recipes, maxAllocationPercent: 90, cycleSeconds: 60 },
    );

    // ratio = 45/90 = 0.5. Per-cycle coal = 0.5 * 10 = 5.
    const coalPerCycle = (perSecond.get(ResourcesIds.Coal) ?? 0) * 60;
    expect(coalPerCycle).toBeCloseTo(5, 10);

    // ratio = 0.5 for copper: 0.5 * 4 = 2.
    const copperPerCycle = (perSecond.get(ResourcesIds.Copper) ?? 0) * 60;
    expect(copperPerCycle).toBeCloseTo(2, 10);
  });

  it("honours a custom maxAllocationPercent", () => {
    const recipes = makeRecipes();
    const result = aggregateConsumptionPerSecond(
      [ResourcesIds.Knight],
      { [ResourcesIds.Knight]: { resourceToResource: 50, laborToResource: 0 } },
      { recipes, maxAllocationPercent: 100, cycleSeconds: 60 },
    );

    // ratio = 50/100 = 0.5. coal = 0.5 * 10 / 60.
    expect(result.get(ResourcesIds.Coal)).toBeCloseTo(5 / 60, 10);
  });

  it("returns an empty map when maxAllocationPercent is not positive", () => {
    const recipes = makeRecipes();
    const result = aggregateConsumptionPerSecond(
      [ResourcesIds.Knight],
      { [ResourcesIds.Knight]: { resourceToResource: 45, laborToResource: 0 } },
      { recipes, maxAllocationPercent: 0 },
    );
    expect(result.size).toBe(0);
  });

  it("clamps ratios greater than 1", () => {
    const recipes = makeRecipes();
    // A percent value above max should be clamped to ratio 1.
    const result = aggregateConsumptionPerSecond(
      [ResourcesIds.Knight],
      { [ResourcesIds.Knight]: { resourceToResource: 180, laborToResource: 0 } },
      { recipes, maxAllocationPercent: 90, cycleSeconds: 60 },
    );
    // Clamped to ratio=1, coal per cycle = 10 -> per-second = 10/60.
    expect(result.get(ResourcesIds.Coal)).toBeCloseTo(10 / 60, 10);
  });
});
