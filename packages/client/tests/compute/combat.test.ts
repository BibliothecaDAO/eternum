import { describe, it, expect } from "vitest";
import {
  computeStrength,
  computeStaminaModifier,
  computeCooldownModifier,
} from "../../src/compute/combat.js";

describe("computeStrength", () => {
  it("should return zero for zero troops", () => {
    expect(computeStrength(0, 1)).toBe(0);
  });

  it("should scale linearly with troop count", () => {
    const strength1 = computeStrength(100, 1);
    const strength2 = computeStrength(200, 1);
    expect(strength2).toBe(strength1 * 2);
  });

  it("should scale with tier", () => {
    const tier1 = computeStrength(100, 1);
    const tier2 = computeStrength(100, 2);
    const tier3 = computeStrength(100, 3);

    expect(tier2).toBeGreaterThan(tier1);
    expect(tier3).toBeGreaterThan(tier2);
  });

  it("should compute consistent values", () => {
    // tier multiplier: tier * 1.0 (base), so tier 1 = 1x, tier 2 = 2x, tier 3 = 3x
    expect(computeStrength(100, 1)).toBe(100);
    expect(computeStrength(100, 2)).toBe(200);
    expect(computeStrength(100, 3)).toBe(300);
  });
});

describe("computeStaminaModifier", () => {
  it("should return 1 for attacker with enough stamina", () => {
    const modifier = computeStaminaModifier(30, true, 20, 10);
    expect(modifier).toBe(1);
  });

  it("should return 0 for attacker without enough stamina", () => {
    const modifier = computeStaminaModifier(10, true, 20, 10);
    expect(modifier).toBe(0);
  });

  it("should return 1 for defender with enough stamina", () => {
    const modifier = computeStaminaModifier(15, false, 20, 10);
    expect(modifier).toBe(1);
  });

  it("should return 0.7 for defender without enough stamina", () => {
    const modifier = computeStaminaModifier(5, false, 20, 10);
    expect(modifier).toBe(0.7);
  });

  it("should return 1 for attacker with exactly enough stamina", () => {
    const modifier = computeStaminaModifier(20, true, 20, 10);
    expect(modifier).toBe(1);
  });

  it("should return 1 for defender with exactly enough stamina", () => {
    const modifier = computeStaminaModifier(10, false, 20, 10);
    expect(modifier).toBe(1);
  });
});

describe("computeCooldownModifier", () => {
  it("should return 1 when cooldown has expired", () => {
    const modifier = computeCooldownModifier(100, 200, true);
    expect(modifier).toBe(1);
  });

  it("should return 0 for attacker still in cooldown", () => {
    const modifier = computeCooldownModifier(200, 100, true);
    expect(modifier).toBe(0);
  });

  it("should return 0.7 for defender still in cooldown", () => {
    const modifier = computeCooldownModifier(200, 100, false);
    expect(modifier).toBe(0.7);
  });

  it("should return 1 when cooldown equals current time", () => {
    const modifier = computeCooldownModifier(100, 100, true);
    expect(modifier).toBe(1);
  });
});
