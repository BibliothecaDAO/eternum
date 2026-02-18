import { describe, it, expect } from "vitest";
import { computeBuildingCost } from "../../src/compute/buildings.js";

describe("computeBuildingCost", () => {
  const baseCosts = [
    { resourceId: 1, name: "Wood", amount: 100 },
    { resourceId: 2, name: "Stone", amount: 50 },
  ];

  it("should return base cost for the first building", () => {
    const result = computeBuildingCost(baseCosts, 0, 10);

    expect(result).toEqual([
      { resourceId: 1, name: "Wood", amount: 100 },
      { resourceId: 2, name: "Stone", amount: 50 },
    ]);
  });

  it("should apply quadratic scaling for the second building", () => {
    const result = computeBuildingCost(baseCosts, 1, 10);

    // existingCount=1: base + 1^2 * (base * increase/100)
    // Wood: 100 + 1 * (100 * 10/100) = 100 + 10 = 110
    // Stone: 50 + 1 * (50 * 10/100) = 50 + 5 = 55
    expect(result).toEqual([
      { resourceId: 1, name: "Wood", amount: 110 },
      { resourceId: 2, name: "Stone", amount: 55 },
    ]);
  });

  it("should apply quadratic scaling for the third building", () => {
    const result = computeBuildingCost(baseCosts, 2, 10);

    // existingCount=2: base + 2^2 * (base * increase/100)
    // Wood: 100 + 4 * (100 * 10/100) = 100 + 40 = 140
    // Stone: 50 + 4 * (50 * 10/100) = 50 + 20 = 70
    expect(result).toEqual([
      { resourceId: 1, name: "Wood", amount: 140 },
      { resourceId: 2, name: "Stone", amount: 70 },
    ]);
  });

  it("should handle zero percent increase", () => {
    const result = computeBuildingCost(baseCosts, 5, 0);

    // No scaling, always base cost
    expect(result).toEqual([
      { resourceId: 1, name: "Wood", amount: 100 },
      { resourceId: 2, name: "Stone", amount: 50 },
    ]);
  });

  it("should handle empty base costs", () => {
    const result = computeBuildingCost([], 3, 10);
    expect(result).toEqual([]);
  });

  it("should handle large existing count", () => {
    const result = computeBuildingCost(baseCosts, 10, 10);

    // existingCount=10: base + 10^2 * (base * 10/100)
    // Wood: 100 + 100 * 10 = 100 + 1000 = 1100
    // Stone: 50 + 100 * 5 = 50 + 500 = 550
    expect(result).toEqual([
      { resourceId: 1, name: "Wood", amount: 1100 },
      { resourceId: 2, name: "Stone", amount: 550 },
    ]);
  });
});
