import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { Matrix4 } from "three";
import { describe, expect, it } from "vitest";

import { TerrainField } from "./terrain-field";
import { terrainCellKey, terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import type { TerrainCellInput } from "./terrain-types";
import { createTerrainWildlife, createTerrainWildlifeMaterial } from "./terrain-wildlife";

function forest(col: number, row = 0): TerrainCellInput {
  return {
    col,
    row,
    biome: BiomeType.TemperateRainForest,
    previewBiome: BiomeType.TemperateRainForest,
    explored: true,
    occupied: false,
  };
}

function forestInterior(): TerrainCellInput[] {
  const center = forest(0);
  const cells = new Map([[terrainCellKey(0, 0), center]]);
  for (const neighbor of terrainNeighborCoordinates(0, 0)) {
    cells.set(terrainCellKey(neighbor.col, neighbor.row), forest(neighbor.col, neighbor.row));
    for (const outer of terrainNeighborCoordinates(neighbor.col, neighbor.row)) {
      cells.set(terrainCellKey(outer.col, outer.row), forest(outer.col, outer.row));
    }
  }
  return [...cells.values()];
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
    const cells = forestInterior();
    const material = createTerrainWildlifeMaterial();
    const first = createTerrainWildlife(cells, field(cells), material)!;
    const reversed = createTerrainWildlife([...cells].reverse(), field(cells), material)!;
    expect(first.count).toBe(3);
    expect(first.geometry.index?.count).toBe(9);
    expect(first.instanceMatrix.array).toEqual(reversed.instanceMatrix.array);
    const origin = new Matrix4();
    first.getMatrixAt(0, origin);
    expect(origin.elements[13]).toBeGreaterThan(1);
    const center = terrainHexToWorld(0, 0);
    expect(origin.elements[12]).toBe(center.x);
    expect(origin.elements[14]).toBe(center.z);
    expect(first.castShadow).toBe(false);
    first.geometry.dispose();
    reversed.geometry.dispose();
    material.dispose();
  });

  it("excludes isolated forest and narrow forest corridors", () => {
    const material = createTerrainWildlifeMaterial();
    for (const cells of [[forest(0)], Array.from({ length: 50 }, (_, index) => forest(index))]) {
      expect(createTerrainWildlife(cells, field(cells), material)).toBeNull();
    }
    material.dispose();
  });

  it.each(["coast", "unexplored", "occupied", "unloaded"])(
    "keeps the full forest margin clear of %s terrain",
    (boundary) => {
      const cells = forestInterior();
      const edge = cells.find((cell) => cell.col === 2 && cell.row === 0)!;
      if (boundary === "coast") Object.assign(edge, { biome: BiomeType.Ocean, previewBiome: BiomeType.Ocean });
      if (boundary === "unexplored") Object.assign(edge, { explored: false, biome: null, previewBiome: null });
      if (boundary === "occupied") edge.occupied = true;
      if (boundary === "unloaded") cells.splice(cells.indexOf(edge), 1);
      const material = createTerrainWildlifeMaterial();
      expect(createTerrainWildlife(cells, field(cells), material)).toBeNull();
      material.dispose();
    },
  );

  it("does not keep an old forest habitat after a lab biome change", () => {
    const cells = forestInterior();
    const material = createTerrainWildlifeMaterial();
    const flock = createTerrainWildlife(cells, field(cells), material)!;
    expect(flock).not.toBeNull();
    const ocean = cells.map((cell) => ({ ...cell, biome: BiomeType.Ocean, previewBiome: BiomeType.Ocean }));
    expect(createTerrainWildlife(ocean, field(ocean), material)).toBeNull();
    flock.geometry.dispose();
    material.dispose();
  });
});
