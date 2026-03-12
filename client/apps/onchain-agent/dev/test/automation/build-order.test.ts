import { describe, it, expect } from "vitest";
import { buildOrderForBiome, troopPathForBiome } from "../../../src/automation/build-order.js";

describe("troopPathForBiome", () => {
  it("maps grassland biomes to Paladin", () => {
    for (const biome of [5, 6, 8, 9, 11, 14]) {
      expect(troopPathForBiome(biome)).toBe("Paladin");
    }
  });

  it("maps forest biomes to Knight", () => {
    for (const biome of [10, 12, 13, 15, 16]) {
      expect(troopPathForBiome(biome)).toBe("Knight");
    }
  });

  it("maps ocean biomes to Crossbowman", () => {
    for (const biome of [1, 2, 3, 4, 7]) {
      expect(troopPathForBiome(biome)).toBe("Crossbowman");
    }
  });

  it("falls back to Paladin for unknown biomes", () => {
    expect(troopPathForBiome(0)).toBe("Paladin");
    expect(troopPathForBiome(99)).toBe("Paladin");
  });
});

describe("buildOrderForBiome", () => {
  it("starts with shared foundation for all paths", () => {
    const foundation = ["WheatFarm", "WoodMill", "CopperSmelter", "CoalMine", "WheatFarm"];

    for (const biome of [11, 12, 2]) {
      const order = buildOrderForBiome(biome);
      const firstLabels = order.steps.slice(0, 5).map((s) => s.label);
      expect(firstLabels).toEqual(foundation);
    }
  });

  it("Paladin path builds Gold → Dragonhide", () => {
    const order = buildOrderForBiome(11); // Grassland
    expect(order.troopPath).toBe("Paladin");
    const labels = order.steps.map((s) => s.label);
    expect(labels).toContain("PaladinT1");
    expect(labels).toContain("GoldMine");
    expect(labels).toContain("PaladinT2");
    expect(labels).toContain("DragonhideTannery");
    expect(labels).toContain("PaladinT3");
    // Gold before PaladinT2, Dragonhide before PaladinT3
    expect(labels.indexOf("GoldMine")).toBeLessThan(labels.indexOf("PaladinT2"));
    expect(labels.indexOf("DragonhideTannery")).toBeLessThan(labels.indexOf("PaladinT3"));
  });

  it("Knight path builds ColdIron → Mithral", () => {
    const order = buildOrderForBiome(12); // Temperate Deciduous Forest
    expect(order.troopPath).toBe("Knight");
    const labels = order.steps.map((s) => s.label);
    expect(labels).toContain("KnightT1");
    expect(labels).toContain("ColdIronFoundry");
    expect(labels).toContain("KnightT2");
    expect(labels).toContain("MithralForge");
    expect(labels).toContain("KnightT3");
    expect(labels.indexOf("ColdIronFoundry")).toBeLessThan(labels.indexOf("KnightT2"));
    expect(labels.indexOf("MithralForge")).toBeLessThan(labels.indexOf("KnightT3"));
  });

  it("Crossbowman path builds Ironwood → Adamantine", () => {
    const order = buildOrderForBiome(2); // Ocean
    expect(order.troopPath).toBe("Crossbowman");
    const labels = order.steps.map((s) => s.label);
    expect(labels).toContain("CrossbowmanT1");
    expect(labels).toContain("IronwoodMill");
    expect(labels).toContain("CrossbowmanT2");
    expect(labels).toContain("AdamantineMine");
    expect(labels).toContain("CrossbowmanT3");
    expect(labels.indexOf("IronwoodMill")).toBeLessThan(labels.indexOf("CrossbowmanT2"));
    expect(labels.indexOf("AdamantineMine")).toBeLessThan(labels.indexOf("CrossbowmanT3"));
  });

  it("every step has a building number and label", () => {
    const order = buildOrderForBiome(11);
    for (const step of order.steps) {
      expect(typeof step.building).toBe("number");
      expect(step.building).toBeGreaterThan(0);
      expect(typeof step.label).toBe("string");
      expect(step.label.length).toBeGreaterThan(0);
    }
  });

  it("Settlement fills all 6 slots with foundation buildings (no T1 troop)", () => {
    const order = buildOrderForBiome(11);
    // All 6 Settlement slots are foundation buildings: no T1 troop
    const settlement = order.steps.slice(0, 6);
    expect(settlement.every((s) => !s.label.includes("T1"))).toBe(true);
    // The 6th step is a second WoodMill
    expect(order.steps[5].label).toBe("WoodMill");
  });
});
