import { describe, expect, it, vi } from "vitest";

vi.mock("@bibliothecadao/types", () => {
  const BiomeType = {
    None: "None",
    DeepOcean: "DeepOcean",
    Ocean: "Ocean",
    Beach: "Beach",
    Scorched: "Scorched",
    Bare: "Bare",
    Tundra: "Tundra",
    Snow: "Snow",
    TemperateDesert: "TemperateDesert",
    Shrubland: "Shrubland",
    Taiga: "Taiga",
    Grassland: "Grassland",
    TemperateDeciduousForest: "TemperateDeciduousForest",
    TemperateRainForest: "TemperateRainForest",
    SubtropicalDesert: "SubtropicalDesert",
    TropicalSeasonalForest: "TropicalSeasonalForest",
    TropicalRainForest: "TropicalRainForest",
  } as const;

  return {
    BiomeType,
    BiomeIdToType: {
      0: BiomeType.None,
      7: BiomeType.Snow,
      10: BiomeType.Taiga,
      11: BiomeType.Grassland,
      12: BiomeType.TemperateDeciduousForest,
    },
  };
});

const { BiomeType } = await import("@bibliothecadao/types");

import { resolveVisibleWorldmapBiome } from "./worldmap-visible-biome";

describe("resolveVisibleWorldmapBiome", () => {
  it("prefers the explored biome when available", () => {
    expect(
      resolveVisibleWorldmapBiome({
        exploredBiome: BiomeType.Taiga,
        isSpectating: true,
        simulateAllExplored: false,
        tileBiomeId: 0,
        simulatedBiome: BiomeType.Grassland,
      }),
    ).toEqual({
      biome: BiomeType.Taiga,
      shouldRenderOutline: false,
    });
  });

  it("uses real tile biome data for spectator terrain when exploration data is missing", () => {
    expect(
      resolveVisibleWorldmapBiome({
        exploredBiome: undefined,
        isSpectating: true,
        simulateAllExplored: false,
        tileBiomeId: 12,
        simulatedBiome: BiomeType.Grassland,
      }),
    ).toEqual({
      biome: BiomeType.TemperateDeciduousForest,
      shouldRenderOutline: false,
    });
  });

  it("falls back to simulated biome when explicitly simulating explored terrain", () => {
    expect(
      resolveVisibleWorldmapBiome({
        exploredBiome: undefined,
        isSpectating: false,
        simulateAllExplored: true,
        tileBiomeId: undefined,
        simulatedBiome: BiomeType.Snow,
      }),
    ).toEqual({
      biome: BiomeType.Snow,
      shouldRenderOutline: false,
    });
  });

  it("renders outline terrain when neither exploration nor spectator tile data is available", () => {
    expect(
      resolveVisibleWorldmapBiome({
        exploredBiome: undefined,
        isSpectating: false,
        simulateAllExplored: false,
        tileBiomeId: undefined,
        simulatedBiome: BiomeType.Snow,
      }),
    ).toEqual({
      biome: null,
      shouldRenderOutline: true,
    });
  });
});
