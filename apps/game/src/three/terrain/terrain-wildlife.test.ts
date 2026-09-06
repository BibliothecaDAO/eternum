import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { Matrix4 } from "three";
import { describe, expect, it } from "vitest";

import { TerrainField } from "./terrain-field";
import type { TerrainCellInput } from "./terrain-types";
import { createTerrainWildlife, createTerrainWildlifeMaterial } from "./terrain-wildlife";

function forest(col: number): TerrainCellInput {
  return {
    col,
    row: 0,
    biome: BiomeType.TemperateRainForest,
    previewBiome: BiomeType.TemperateRainForest,
    explored: true,
    occupied: false,
  };
}

function field(cells: TerrainCellInput[]): TerrainField {
  return new TerrainField({
    cells,
    halo: [],
    climate: NEUTRAL_BIOME_CLIMATE,
    mapCenter: 0,
    pageKey: "birds",
    roadSegments: [],
    settlementAnchors: [],
  });
}

describe("terrain wildlife", () => {
  it("never spawns on unknown, occupied, or non-forest terrain", () => {
    const cells = [
      { ...forest(0), explored: false, biome: null },
      { ...forest(1), occupied: true },
      { ...forest(2), biome: BiomeType.Ocean, previewBiome: BiomeType.Ocean },
    ];
    const material = createTerrainWildlifeMaterial();
    expect(createTerrainWildlife(cells, field(cells), material)).toBeNull();
    material.dispose();
  });

  it("keeps a bounded flock at the same habitat regardless of cell traversal order", () => {
    const cells = Array.from({ length: 50 }, (_, index) => forest(index));
    const material = createTerrainWildlifeMaterial();
    const first = createTerrainWildlife(cells, field(cells), material)!;
    const reversed = createTerrainWildlife([...cells].reverse(), field(cells), material)!;
    expect(first.count).toBe(3);
    expect(first.geometry.index?.count).toBe(9);
    expect(first.instanceMatrix.array).toEqual(reversed.instanceMatrix.array);
    const origin = new Matrix4();
    first.getMatrixAt(0, origin);
    expect(origin.elements[13]).toBeGreaterThan(1);
    expect(first.castShadow).toBe(false);
    first.geometry.dispose();
    reversed.geometry.dispose();
    material.dispose();
  });
});
