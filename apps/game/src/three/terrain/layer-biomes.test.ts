import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";
import { DEEP_PALETTE } from "./deep-floor-material";
import { LAYER_BIOME_LOOKS, LAYER_BIOMES, layerBiomeAt, layerGroundColour } from "./layer-biomes";

const climate = { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 17, moisture_seed: 42 };
const rules = { spacing: 100, dayUnitSeconds: 3600, startMainAt: 0, scheduledEndAt: 999999, endAt: 999999, seed: 1n };

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

  it("colours a layer hex by its biome, the Deep by its slate, and leaves the Surface to its own biome", () => {
    const veil = { col: 12, row: 130, alt: false };
    const hollow = { col: 12, row: 230, alt: false };
    expect(layerGroundColour(rules, false, { col: 12, row: 30, alt: false }, climate)).toBeNull();
    expect(layerGroundColour(rules, false, veil, climate)).toBe(
      LAYER_BIOME_LOOKS[layerBiomeAt(1, 12, 130, climate)].ground,
    );
    expect(layerGroundColour(rules, false, hollow, climate)).toBe(
      LAYER_BIOME_LOOKS[layerBiomeAt(2, 12, 230, climate)].ground,
    );
    const deepRules = { ...rules, spacing: 1024 };
    expect(layerGroundColour(deepRules, true, { col: 512, row: 3584, alt: false }, climate)).toBe(DEEP_PALETTE.slate);
  });
});
