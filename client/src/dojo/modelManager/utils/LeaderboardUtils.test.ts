import { describe, expect, it, vi } from "vitest";
import { TOTAL_CONTRIBUTABLE_AMOUNT } from "./LeaderboardUtils";

const EXPECTED_TOTAL_CONTRIBUTABLE_AMOUNT = 2.58;

vi.mock("@bibliothecadao/eternum", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    EternumGlobalConfig: {
      troop: { health: 1 },
      resources: {
        resourcePrecision: 1,
      },
    },
    HYPERSTRUCTURE_TOTAL_COSTS_SCALED: [
      { resource: 1, amount: 1 },
      { resource: 2, amount: 1 },
    ],
    HyperstructureResourceMultipliers: {
      ["1"]: 1.0,
      ["2"]: 1.0,
    },
  };
});

describe("TOTAL_CONTRIBUTABLE_AMOUNT", () => {
  it("should return a valid amount", () => {
    expect(TOTAL_CONTRIBUTABLE_AMOUNT).toBe(EXPECTED_TOTAL_CONTRIBUTABLE_AMOUNT);
  });
});

// describe("getTotalPointsPercentage", () => {
//   it("should return a valid amount for resource 1", () => {
//     expect(getTotalPointsPercentage(1, 1n)).toBe(0.5);
//   });

//   it("should return a valid amount for resource 2", () => {
//     expect(getTotalPointsPercentage(2, 1n)).toBe(0.5);
//   });
// });

// describe("computeInitialContributionPoints", () => {
//   it("should return a valid initial points contribution", () => {
//     expect(computeInitialContributionPoints(1, 1n, 100)).toBe(50);
//   });

//   it("should return a valid initial points contribution for resource 2", () => {
//     expect(computeInitialContributionPoints(2, 1n, 100)).toBe(50);
//   });
// });
