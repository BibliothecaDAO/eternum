import { describe, it, expect } from "vitest";
import { calculateStrength, calculateGuardStrength, biomeCombatModifiers } from "../../../src/world/strength.js";

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
    expect(s.modifier).toBe(30);
    expect(s.effective).toBe(1300);
  });

  it("Crossbowman gets -30% on Grassland (biome 11)", () => {
    const s = calculateStrength(1000, "T1", "Crossbowman", 11);
    expect(s.modifier).toBe(-30);
    expect(s.effective).toBe(700);
  });

  it("Knight is neutral on Grassland (biome 11)", () => {
    const s = calculateStrength(1000, "T1", "Knight", 11);
    expect(s.modifier).toBe(0);
    expect(s.effective).toBe(1000);
  });

  it("Knight gets +30% in Tropical Seasonal Forest (biome 15)", () => {
    const s = calculateStrength(1000, "T1", "Knight", 15);
    expect(s.modifier).toBe(30);
    expect(s.effective).toBe(1300);
  });

  it("no modifier for unknown biome", () => {
    const s = calculateStrength(1000, "T1", "Knight", 99);
    expect(s.modifier).toBe(0);
    expect(s.effective).toBe(1000);
  });

  it("T2 with modifier", () => {
    const s = calculateStrength(1000, "T2", "Paladin", 11);
    expect(s.base).toBe(2500);
    expect(s.effective).toBe(3250);
  });
});

describe("biomeCombatModifiers", () => {
  it("Snow (7): Knight -30, Crossbowman +30, Paladin 0", () => {
    const m = biomeCombatModifiers(7);
    expect(m.Knight).toBe(-30);
    expect(m.Crossbowman).toBe(30);
    expect(m.Paladin).toBe(0);
  });

  it("Grassland (11): Knight 0, Crossbowman -30, Paladin +30", () => {
    const m = biomeCombatModifiers(11);
    expect(m.Knight).toBe(0);
    expect(m.Crossbowman).toBe(-30);
    expect(m.Paladin).toBe(30);
  });

  it("Forest (15): Knight +30, Crossbowman 0, Paladin -30", () => {
    const m = biomeCombatModifiers(15);
    expect(m.Knight).toBe(30);
    expect(m.Crossbowman).toBe(0);
    expect(m.Paladin).toBe(-30);
  });

  it("unknown biome returns all zeros", () => {
    const m = biomeCombatModifiers(99);
    expect(m.Knight).toBe(0);
    expect(m.Crossbowman).toBe(0);
    expect(m.Paladin).toBe(0);
  });
});

describe("calculateGuardStrength", () => {
  it("sums multiple guard slots", () => {
    const guards = [
      { count: 500, troopTier: "T1", troopType: "Knight" },
      { count: 300, troopTier: "T2", troopType: "Knight" },
    ];
    const s = calculateGuardStrength(guards, 0);
    expect(s.base).toBe(1250);
  });

  it("returns zero for no guards", () => {
    const s = calculateGuardStrength([], 11);
    expect(s.base).toBe(0);
    expect(s.effective).toBe(0);
  });

  it("uses biome modifier of the largest guard group", () => {
    const guards = [
      { count: 100, troopTier: "T1", troopType: "Knight" },
      { count: 800, troopTier: "T1", troopType: "Paladin" },
    ];
    const s = calculateGuardStrength(guards, 11);
    expect(s.modifier).toBe(30);
  });

  it("shows negative modifier from dominant guard", () => {
    const guards = [
      { count: 1000, troopTier: "T2", troopType: "Crossbowman" },
    ];
    const s = calculateGuardStrength(guards, 11);
    expect(s.modifier).toBe(-30);
    expect(s.base).toBe(2500);
    expect(s.effective).toBe(1750);
  });
});
