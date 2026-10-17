import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { biomeDisplayName } from "./biome-name";

describe("a biome's name", () => {
  it("reads as words, as the tile panel shows it", () => {
    expect(biomeDisplayName(BiomeType.SubtropicalDesert)).toBe("Subtropical Desert");
    expect(biomeDisplayName(BiomeType.TemperateRainForest)).toBe("Temperate Rain Forest");
    expect(biomeDisplayName(BiomeType.Grassland)).toBe("Grassland");
  });
});
