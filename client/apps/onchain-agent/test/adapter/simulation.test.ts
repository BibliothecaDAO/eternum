import { describe, expect, it, vi } from "vitest";
import { computeStaminaModifier, computeCooldownModifier } from "@bibliothecadao/client";

vi.mock("@bibliothecadao/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bibliothecadao/client")>();
  return {
    ...actual,
    computeStrength: vi.fn((count: number, tier: number) => count * tier * 10),
    computeOutputAmount: vi.fn(() => 123),
    computeSlippage: vi.fn(() => 2.5),
    computeBuildingCost: vi.fn((baseCosts: any[]) =>
      baseCosts.map((c) => ({ ...c, amount: c.amount + 1 })),
    ),
  };
});

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

  it("simulates market output with slippage", () => {
    const result = simulateAction({
      type: "buy_resources",
      params: { amount: 5, reserveIn: 100, reserveOut: 200, feeNum: 1, feeDenom: 1000 },
    });

    expect(result.success).toBe(true);
    expect(result.outcome.estimatedOutput).toBe(123);
    expect(result.outcome.inputAmount).toBe(5);
    expect(result.outcome.slippagePercent).toBeDefined();
    expect(result.outcome.priceImpact).toBeDefined();
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

  it("simulates move_explorer stamina cost", () => {
    const result = simulateAction({
      type: "move_explorer",
      params: {
        directions: [0, 1, 2],
        explore: true,
        explorerStamina: 100,
        exploreCost: 30,
        travelCost: 20,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outcome.totalStaminaCost).toBe(90); // 3 * 30
    expect(result.outcome.canComplete).toBe(true); // 100 >= 90
    expect(result.outcome.stepsAffordable).toBe(3); // floor(100/30) = 3
  });

  it("move_explorer warns when stamina insufficient", () => {
    const result = simulateAction({
      type: "move_explorer",
      params: {
        directions: [0, 1, 2, 3, 4],
        explore: true,
        explorerStamina: 100,
        exploreCost: 30,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outcome.totalStaminaCost).toBe(150); // 5 * 30
    expect(result.outcome.canComplete).toBe(false); // 100 < 150
    expect(result.outcome.stepsAffordable).toBe(3); // floor(100/30) = 3
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

  it("combat simulation includes stamina and cooldown modifiers", () => {
    const result = simulateAction({
      type: "attack_explorer",
      params: {
        amount: 10, tier: 2,
        attackerStamina: 60, defenderStamina: 5,
        attackReq: 50, defenseReq: 10,
        attackerCooldownEnd: 0, defenderCooldownEnd: 0,
        currentTime: 1000,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outcome.canAttack).toBe(true);
    expect(result.outcome.attackerPenalties.staminaModifier).toBe(1);
    expect(result.outcome.defenderPenalties.staminaModifier).toBe(0.7);
  });

  it("combat simulation warns when attacker cannot attack due to stamina", () => {
    const result = simulateAction({
      type: "attack_guard",
      params: {
        amount: 10, tier: 2,
        attackerStamina: 20, defenderStamina: 50,
        attackReq: 50, defenseReq: 10,
        attackerCooldownEnd: 0, defenderCooldownEnd: 0,
        currentTime: 1000,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outcome.canAttack).toBe(false);
    expect(result.outcome.warning).toContain("Insufficient stamina");
  });

  it("combat simulation warns when attacker is on cooldown", () => {
    const result = simulateAction({
      type: "raid",
      params: {
        amount: 10, tier: 2,
        attackerStamina: 60, defenderStamina: 50,
        attackReq: 50, defenseReq: 10,
        attackerCooldownEnd: 9999999999, defenderCooldownEnd: 0,
        currentTime: 1000,
      },
    });

    expect(result.success).toBe(true);
    expect(result.outcome.canAttack).toBe(false);
    expect(result.outcome.warning).toContain("On cooldown");
  });
});

describe("combat modifiers (unit)", () => {
  it("returns 0 for attacker with insufficient stamina", () => {
    const mod = computeStaminaModifier(20, true, 30, 10);
    expect(mod).toBe(0);
  });

  it("returns 1.0 for attacker with sufficient stamina", () => {
    const mod = computeStaminaModifier(50, true, 30, 10);
    expect(mod).toBe(1);
  });

  it("returns 0.7 penalty for defender with insufficient stamina", () => {
    const mod = computeStaminaModifier(5, false, 30, 10);
    expect(mod).toBe(0.7);
  });

  it("returns 0 for attacker on cooldown", () => {
    const mod = computeCooldownModifier(9999999999, 1000, true);
    expect(mod).toBe(0);
  });

  it("returns 0.7 penalty for defender on cooldown", () => {
    const mod = computeCooldownModifier(9999999999, 1000, false);
    expect(mod).toBe(0.7);
  });
});
