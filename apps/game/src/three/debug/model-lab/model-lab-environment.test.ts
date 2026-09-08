// @vitest-environment node
import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { createModelLabTerrainRequest, MODEL_LAB_BIOMES } from "./model-lab-environment";

describe("model lab production biome fixtures", () => {
  it("connects ocean, beach and the selected biome without settlement disturbance", () => {
    for (const biome of Object.keys(MODEL_LAB_BIOMES) as Array<keyof typeof MODEL_LAB_BIOMES>) {
      const request = createModelLabTerrainRequest({ family: "ships", biome });
      const biomes = new Set(request.cells.map((cell) => cell.biome));
      expect(biomes).toEqual(
        new Set([BiomeType.DeepOcean, BiomeType.Ocean, BiomeType.Beach, MODEL_LAB_BIOMES[biome].biome]),
      );
      expect(request.cells.every((cell) => cell.explored && !cell.occupied)).toBe(true);
      expect(request.halo.length).toBeGreaterThan(0);
      expect(request.flatSurface).not.toBe(true);
    }
  });
  it("puts army review on the selected land biome", () => {
    const request = createModelLabTerrainRequest({ family: "knight", biome: "snow" });
    expect(request.cells.every((cell) => cell.biome === BiomeType.Snow)).toBe(true);
  });
});
