import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";
import { LAYER_BIOMES, layerBiomeAt } from "./layer-biomes";

const climate = { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 17, moisture_seed: 42 };

describe("the layers' client biomes", () => {
  it("lays every biome of each layer somewhere across a region, the same on every read", () => {
    for (const layer of [1, 2] as const) {
      const seen = new Set<string>();
      for (let col = 0; col < 60; col += 1)
        for (let row = 0; row < 60; row += 1) {
          const biome = layerBiomeAt(layer, col, row, climate);
          expect(layerBiomeAt(layer, col, row, climate)).toBe(biome);
          seen.add(biome);
        }
      expect([...seen].sort()).toEqual([...LAYER_BIOMES[layer]].sort());
    }
  });
});
