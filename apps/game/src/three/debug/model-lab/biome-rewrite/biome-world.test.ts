import { Biome } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { TERRAIN_BIOME_ORDER } from "../../../terrain/terrain-palette";
import { createBiomeWorld, resolveStage, SURFACES } from "./biome-world";

const isWater = (biome: BiomeType) => biome === BiomeType.Ocean || biome === BiomeType.DeepOcean;

describe("biome rewrite world", () => {
  it("draws the same ground for the same seed and coordinates", () => {
    const first = createBiomeWorld("bench");
    const second = createBiomeWorld("bench");
    for (let step = 0; step < 300; step++) {
      const x = 0.3 + (step % 20) * 1.6,
        z = 0.2 + Math.floor(step / 20) * 1.5;
      expect(second.heightAt(x, z)).toBe(first.heightAt(x, z));
      expect(second.surfacesAt(x, z)).toEqual(first.surfacesAt(x, z));
    }
  });

  it.each(["bench", "seeded"] as const)(
    "shows every hex's own biome at its centre, land above water and sea below (%s)",
    (field) => {
      const world = createBiomeWorld(field);
      for (const cell of world.cells) {
        expect(world.biomeAt(cell.x, cell.z)).toBe(cell.biome);
        if (isWater(cell.biome)) expect(world.heightAt(cell.x, cell.z)).toBeLessThan(0);
        else expect(world.heightAt(cell.x, cell.z)).toBeGreaterThan(0);
      }
    },
  );

  it("puts every one of the 16 biomes on the World biomes field", () => {
    const biomes = new Set(createBiomeWorld("bench").cells.map((cell) => cell.biome));
    expect([...biomes].toSorted()).toEqual([...TERRAIN_BIOME_ORDER].toSorted());
  });

  it("takes a real map region's biome, elevation and moisture from the contract", () => {
    const world = createBiomeWorld("seeded");
    for (const cell of world.cells) {
      const contract = Biome.sampleEnvironment(cell.col + 60, cell.row + 60, {
        elevation_scale_bps: 10_000,
        moisture_scale_bps: 10_000,
        elevation_bias_bps: 10_000,
        moisture_bias_bps: 10_000,
        elevation_seed: 2024,
        moisture_seed: 5,
      });
      expect(cell).toMatchObject(contract);
    }
  });

  it("paints every point with surface weights that sum to one", () => {
    const world = createBiomeWorld("bench");
    for (let step = 0; step < 200; step++) {
      const weights = world.surfacesAt(0.4 + (step % 20) * 1.7, 0.6 + Math.floor(step / 20) * 2.1);
      expect(weights).toHaveLength(SURFACES.length);
      expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 6);
    }
  });

  it.each(TERRAIN_BIOME_ORDER)("stands a realm and an army on land near %s", (biome) => {
    const world = createBiomeWorld("bench");
    const own = world.cells.find((cell) => cell.biome === biome)!;
    const { realm, army } = resolveStage(world, own);
    expect(isWater(realm.biome) || isWater(army.biome)).toBe(false);
    if (!isWater(biome)) expect(army.biome).toBe(biome);
  });
});
