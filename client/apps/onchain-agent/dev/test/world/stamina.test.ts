import { describe, it, expect } from "vitest";
import { projectStamina, getMaxStamina, projectExplorerStamina } from "../../../src/world/stamina.js";

describe("getMaxStamina", () => {
  it("returns base max for T1 troops", () => {
    expect(getMaxStamina("Knight", "T1", 160)).toBe(160);
    expect(getMaxStamina("Paladin", "T1", 180)).toBe(180);
    expect(getMaxStamina("Crossbowman", "T1", 140)).toBe(140);
  });

  it("adds 20 for T2 troops", () => {
    expect(getMaxStamina("Knight", "T2", 160)).toBe(180);
  });

  it("adds 40 for T3 troops", () => {
    expect(getMaxStamina("Knight", "T3", 160)).toBe(200);
  });
});

describe("projectStamina", () => {
  it("projects stamina forward by elapsed ticks × gain", () => {
    const result = projectStamina({
      currentAmount: 10,
      updatedTick: 100,
      currentTick: 110,
      gainPerTick: 7,
      maxStamina: 200,
    });
    expect(result).toBe(80);
  });

  it("caps at max stamina", () => {
    const result = projectStamina({
      currentAmount: 150,
      updatedTick: 0,
      currentTick: 100,
      gainPerTick: 7,
      maxStamina: 200,
    });
    expect(result).toBe(200);
  });

  it("returns current amount when no ticks elapsed", () => {
    const result = projectStamina({
      currentAmount: 50,
      updatedTick: 100,
      currentTick: 100,
      gainPerTick: 7,
      maxStamina: 200,
    });
    expect(result).toBe(50);
  });

  it("returns current amount when updatedTick is ahead of currentTick", () => {
    const result = projectStamina({
      currentAmount: 50,
      updatedTick: 110,
      currentTick: 100,
      gainPerTick: 7,
      maxStamina: 200,
    });
    expect(result).toBe(50);
  });

  it("handles zero gain per tick", () => {
    const result = projectStamina({
      currentAmount: 50,
      updatedTick: 0,
      currentTick: 100,
      gainPerTick: 0,
      maxStamina: 200,
    });
    expect(result).toBe(50);
  });
});

describe("projectExplorerStamina", () => {
  const staminaConfig = {
    travelCost: 10,
    exploreCost: 30,
    bonusValue: 10,
    gainPerTick: 7,
    knightMaxStamina: 160,
    paladinMaxStamina: 180,
    crossbowmanMaxStamina: 140,
    armiesTickInSeconds: 1,
  };

  it("projects explorer stamina using config values", () => {
    const explorer = { stamina: 10, staminaUpdatedTick: 100, troopType: "Knight", troopTier: "T1" };
    // At tick 110: 10 + (10 × 7) = 80, max 160
    const result = projectExplorerStamina(explorer, staminaConfig, 110);
    expect(result).toBe(80);
  });

  it("uses correct max stamina for troop type and tier", () => {
    const explorer = { stamina: 0, staminaUpdatedTick: 0, troopType: "Paladin", troopTier: "T3" };
    // Paladin T3 max = 180 + 40 = 220. 1000 ticks × 7 = 7000, capped at 220
    const result = projectExplorerStamina(explorer, staminaConfig, 1000);
    expect(result).toBe(220);
  });

  it("handles armiesTickInSeconds > 1", () => {
    const config = { ...staminaConfig, armiesTickInSeconds: 5 };
    const explorer = { stamina: 10, staminaUpdatedTick: 20, troopType: "Knight", troopTier: "T1" };
    // nowSeconds=110, currentTick = floor(110/5) = 22, elapsed = 22-20 = 2
    // gain = 2 × 7 = 14, projected = 10 + 14 = 24
    const result = projectExplorerStamina(explorer, config, 110);
    expect(result).toBe(24);
  });
});
