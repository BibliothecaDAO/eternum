import { describe, it, expect } from "vitest";
import { calculateStrength, calculateGuardStrength } from "../../../src/world/strength.js";

describe("calculateStrength — tier multipliers", () => {
  it("T1: 1,000 troops = strength 1,000", () => {
    const s = calculateStrength(1000, "T1", "Knight", 0);
    expect(s.base).toBe(1000);
  });

  it("T2: 1,000 troops = strength 2,500", () => {
    const s = calculateStrength(1000, "T2", "Knight", 0);
    expect(s.base).toBe(2500);
  });

  it("T3: 1,000 troops = strength 7,000", () => {
    const s = calculateStrength(1000, "T3", "Knight", 0);
    expect(s.base).toBe(7000);
  });

  it("scales linearly with troop count", () => {
    const s500 = calculateStrength(500, "T1", "Knight", 0);
    const s1000 = calculateStrength(1000, "T1", "Knight", 0);
    expect(s1000.base).toBe(s500.base * 2);
  });

  it("handles zero troops", () => {
    const s = calculateStrength(0, "T3", "Paladin", 11);
    expect(s.base).toBe(0);
  });
});

describe("calculateStrength — biome modifiers", () => {
  it("Paladin gets +30% on Grassland (biome 11)", () => {
    const s = calculateStrength(1000, "T1", "Paladin", 11);
    expect(s.biomeModifier).toBe(30);
    expect(s.display).toContain("+30%");
  });

  it("Crossbowman gets -30% on Grassland (biome 11)", () => {
    const s = calculateStrength(1000, "T1", "Crossbowman", 11);
    expect(s.biomeModifier).toBe(-30);
    expect(s.display).toContain("-30%");
  });

  it("Knight is neutral on Grassland (biome 11)", () => {
    const s = calculateStrength(1000, "T1", "Knight", 11);
    expect(s.biomeModifier).toBe(0);
    expect(s.display).not.toContain("%");
  });

  it("Knight gets +30% in Forest (biome 12)", () => {
    const s = calculateStrength(1000, "T1", "Knight", 12);
    expect(s.biomeModifier).toBe(30);
    expect(s.display).toContain("+30%");
  });

  it("no modifier for unknown biome", () => {
    const s = calculateStrength(1000, "T1", "Knight", 99);
    expect(s.biomeModifier).toBe(0);
  });
});

describe("calculateStrength — display format", () => {
  it("includes comma formatting for large numbers", () => {
    const s = calculateStrength(10000, "T3", "Paladin", 0);
    expect(s.base).toBe(70000);
    expect(s.display).toContain("70,000");
  });

  it("shows base only when no biome modifier", () => {
    const s = calculateStrength(1000, "T1", "Knight", 11);
    expect(s.display).toBe("1,000");
  });

  it("shows modifier with base", () => {
    const s = calculateStrength(1000, "T2", "Paladin", 11);
    expect(s.display).toBe("2,500 (+30% on this tile)");
  });
});

describe("calculateGuardStrength", () => {
  it("sums multiple guard slots", () => {
    const guards = [
      { count: 500, troopTier: "T1", troopType: "Knight" },
      { count: 300, troopTier: "T2", troopType: "Knight" },
    ];
    const s = calculateGuardStrength(guards, 0);
    // 500*100/100 + 300*250/100 = 500 + 750 = 1250
    expect(s.base).toBe(1250);
  });

  it("returns zero for no guards", () => {
    const s = calculateGuardStrength([], 11);
    expect(s.base).toBe(0);
    expect(s.display).toBe("0");
  });

  it("uses biome modifier of the largest guard group", () => {
    const guards = [
      { count: 100, troopTier: "T1", troopType: "Knight" },   // neutral on Grassland
      { count: 800, troopTier: "T1", troopType: "Paladin" },  // +30% on Grassland
    ];
    const s = calculateGuardStrength(guards, 11);
    expect(s.biomeModifier).toBe(30);
    expect(s.display).toContain("+30%");
  });

  it("shows negative modifier from dominant guard", () => {
    const guards = [
      { count: 1000, troopTier: "T2", troopType: "Crossbowman" }, // -30% on Grassland
    ];
    const s = calculateGuardStrength(guards, 11);
    expect(s.biomeModifier).toBe(-30);
    expect(s.base).toBe(2500);
  });
});
