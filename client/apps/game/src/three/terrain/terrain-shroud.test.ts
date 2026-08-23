import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { terrainHexToWorld } from "./terrain-coordinates";
import { TerrainField } from "./terrain-field";
import { prepareTerrainShroudInstances } from "./terrain-shroud";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";

describe("terrain exploration shroud", () => {
  it("creates deterministic cover only for unexplored cells", () => {
    const cells = [explored(0, 0, BiomeType.Grassland), unknown(1, 0), unknown(2, 0)];
    const request = fixture(cells);

    const first = prepareTerrainShroudInstances(request, new TerrainField(request));
    const second = prepareTerrainShroudInstances(request, new TerrainField(request));

    expect(first).toEqual(second);
    expect(first.map(({ col, row }) => [col, row])).toEqual([
      [1, 0],
      [2, 0],
    ]);
    expect(first[0].frontier).toBe(true);
    expect(first[1].frontier).toBe(false);
    expect(first[1].frontierDirection).toEqual([0, 0]);
    const frontierCenter = terrainHexToWorld(1, 0);
    const exploredCenter = terrainHexToWorld(0, 0);
    const towardExplored = [exploredCenter.x - frontierCenter.x, exploredCenter.z - frontierCenter.z];
    expect(
      first[0].frontierDirection[0] * towardExplored[0] + first[0].frontierDirection[1] * towardExplored[1],
    ).toBeGreaterThan(0);
  });

  it("tints only from explored neighbors while the preview surface follows its explicit biome", () => {
    const coldRequest = fixture([explored(0, 0, BiomeType.Snow), unknown(1, 0)]);
    const aridRequest = fixture([explored(0, 0, BiomeType.SubtropicalDesert), unknown(1, 0)]);
    const cold = prepareTerrainShroudInstances(coldRequest, new TerrainField(coldRequest))[0];
    const arid = prepareTerrainShroudInstances(aridRequest, new TerrainField(aridRequest))[0];

    expect(cold.tint).not.toEqual(arid.tint);
    expect(cold.worldY).toBeGreaterThan(-1);
    expect(arid.worldY).toBeGreaterThan(-1);
  });

  it("rejects contradictory exploration and biome state loudly", () => {
    const request = fixture([
      {
        biome: BiomeType.Grassland,
        col: 0,
        explored: false,
        occupied: false,
        previewBiome: BiomeType.Grassland,
        row: 0,
      },
    ]);

    expect(() => new TerrainField(request)).toThrow(/inconsistent exploration and biome state/);
  });

  it("keeps second-ring unknown cover finite when explored candidates are outside blend support", () => {
    const request = fixture([explored(0, 0, BiomeType.Grassland), unknown(1, 0), unknown(2, 0)]);
    const instances = prepareTerrainShroudInstances(request, new TerrainField(request));

    expect(instances.every(({ worldY }) => Number.isFinite(worldY))).toBe(true);
  });
});

function explored(col: number, row: number, biome: BiomeType): TerrainCellInput {
  return { biome, col, explored: true, occupied: false, previewBiome: biome, row };
}

function unknown(col: number, row: number, previewBiome = BiomeType.Grassland): TerrainCellInput {
  return { biome: null, col, explored: false, occupied: false, previewBiome, row };
}

function fixture(cells: TerrainCellInput[]): TerrainPageRequest {
  return {
    cells,
    climate: NEUTRAL_BIOME_CLIMATE,
    generation: 1,
    halo: [],
    mapCenter: 0,
    pageKey: "shroud-fixture",
    subdivisions: 2,
  };
}
