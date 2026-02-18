import { describe, expect, it, vi } from "vitest";

vi.mock("@bibliothecadao/client", () => ({
  computeStrength: vi.fn((count: number, tier: number) => count * tier * 10),
  computeOutputAmount: vi.fn(() => 123),
  computeBuildingCost: vi.fn((baseCosts: any[]) => baseCosts.map((c) => ({ ...c, amount: c.amount + 1 }))),
}));

const { simulateAction } = await import("../../src/adapter/simulation");

describe("simulateAction", () => {
  it("simulates combat action strength", () => {
    const result = simulateAction({
      type: "attack_guard",
      params: { amount: 12, tier: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.outcome).toEqual({ estimatedStrength: 360 });
    expect(result.cost).toEqual({ troops: 12 });
  });

  it("simulates market output", () => {
    const result = simulateAction({
      type: "buy_resources",
      params: { amount: 5, reserveIn: 100, reserveOut: 200, feeNum: 1, feeDenom: 1000 },
    });

    expect(result.success).toBe(true);
    expect(result.outcome).toEqual({ estimatedOutput: 123, inputAmount: 5 });
    expect(result.cost).toEqual({ inputAmount: 5 });
  });

  it("simulates create_building cost when base costs are present", () => {
    const result = simulateAction({
      type: "create_building",
      params: {
        buildingCategory: 2,
        baseCosts: [{ resourceId: 1, name: "Wood", amount: 10 }],
        existingCount: 1,
        costPercentIncrease: 10,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outcome).toEqual({ buildingCategory: 2 });
    expect(result.cost).toEqual({
      resources: [{ resourceId: 1, name: "Wood", amount: 11 }],
    });
  });

  it("returns informational message when base costs are missing", () => {
    const result = simulateAction({
      type: "create_building",
      params: { buildingCategory: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.outcome).toEqual({
      buildingCategory: 3,
      message: "No baseCosts provided; cannot estimate resource cost.",
    });
  });

  it("returns default message for unknown action types", () => {
    const result = simulateAction({ type: "unknown", params: {} });

    expect(result.success).toBe(true);
    expect(result.outcome).toEqual({
      message: "No simulation model for action type: unknown",
    });
  });

  it("returns failure when a compute function throws", async () => {
    const module = await import("@bibliothecadao/client");
    vi.mocked(module.computeStrength).mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const result = simulateAction({
      type: "create_explorer",
      params: { amount: 1, tier: 1 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("boom");
  });
});
