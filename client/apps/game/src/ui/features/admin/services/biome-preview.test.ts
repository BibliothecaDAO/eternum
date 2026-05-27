import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, test } from "vitest";
import { buildBiomePreviewClimate, buildBiomePreviewModel } from "./biome-preview";

const BASE_CLIMATE = {
  elevationScaleBps: 10000,
  moistureScaleBps: 10000,
  elevationBiasBps: 10000,
  moistureBiasBps: 10000,
  elevationSeed: 0,
  moistureSeed: 0,
};

describe("biome preview", () => {
  test("builds a deterministic tile preview with biome distribution", () => {
    const climate = buildBiomePreviewClimate({
      baseClimate: BASE_CLIMATE,
      overrides: {
        elevationScaleBps: "12000",
        moistureScaleBps: "9000",
        elevationBiasBps: "11000",
        moistureBiasBps: "8000",
        elevationSeed: "137",
        moistureSeed: "991",
      },
    });

    const preview = buildBiomePreviewModel({ climate, size: 5, center: 0 });

    expect(climate).toEqual({
      elevation_scale_bps: 12000,
      moisture_scale_bps: 9000,
      elevation_bias_bps: 11000,
      moisture_bias_bps: 8000,
      elevation_seed: 137,
      moisture_seed: 991,
    });
    expect(preview.tiles).toHaveLength(25);
    expect(preview.distribution.reduce((sum, entry) => sum + entry.count, 0)).toBe(25);
    expect(preview.distribution[0]?.biome).toBeDefined();
    expect(preview.tiles.every((tile) => tile.color.startsWith("#"))).toBe(true);
  });

  test("changes preview tiles when seeds change", () => {
    const neutralPreview = buildBiomePreviewModel({
      climate: buildBiomePreviewClimate({
        baseClimate: BASE_CLIMATE,
        overrides: {},
      }),
      size: 7,
      center: 0,
    });
    const seededPreview = buildBiomePreviewModel({
      climate: buildBiomePreviewClimate({
        baseClimate: BASE_CLIMATE,
        overrides: {
          elevationSeed: "137",
          moistureSeed: "991",
        },
      }),
      size: 7,
      center: 0,
    });

    expect(seededPreview.tiles.map((tile) => tile.biome)).not.toEqual(neutralPreview.tiles.map((tile) => tile.biome));
    expect(seededPreview.distribution.some((entry) => entry.biome !== BiomeType.None)).toBe(true);
  });

  test("samples normalized preview coordinates in contract space", () => {
    const preview = buildBiomePreviewModel({
      climate: buildBiomePreviewClimate({
        baseClimate: BASE_CLIMATE,
        overrides: {},
      }),
      size: 3,
      center: 0,
      mapCenter: 100,
    });

    expect(preview.tiles.map((tile) => [tile.col, tile.row])).toEqual([
      [99, 99],
      [100, 99],
      [101, 99],
      [99, 100],
      [100, 100],
      [101, 100],
      [99, 101],
      [100, 101],
      [101, 101],
    ]);
  });
});
