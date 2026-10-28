import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { terrainHexToWorld } from "./terrain-coordinates";
import { TerrainField } from "./terrain-field";
import { prepareTerrainPage } from "./terrain-page-builder";
import type { TerrainCellInput, TerrainPageRequest, TerrainTileLook } from "./terrain-types";

const BIOMES = [BiomeType.Snow, BiomeType.Bare, BiomeType.Taiga, BiomeType.SubtropicalDesert, BiomeType.Scorched];

/** A 6×6 patch of mixed biomes, every tile explored, so every interior edge and corner is shared by land. */
const request = (tileLook?: TerrainTileLook): TerrainPageRequest => {
  const cells: TerrainCellInput[] = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const biome = BIOMES[(col * 7 + row * 3) % BIOMES.length];
      cells.push({ col, row, biome, previewBiome: biome, occupied: false, explored: true });
    }
  }
  return {
    cells,
    halo: [],
    climate: NEUTRAL_BIOME_CLIMATE,
    mapCenter: 0,
    pageKey: `tile-shape-${tileLook ?? "today"}`,
    roadSegments: [],
    settlementAnchors: [],
    subdivisions: tileLook ? 4 : 3,
    ...(tileLook ? { tileLook } : {}),
  };
};

describe("tile looks", () => {
  it.each(["relief", "tiles"] as const)("leaves no crack where %s tiles meet", (look) => {
    const positions = prepareTerrainPage(request(look)).buffers.positions;
    const heightsAt = new Map<string, number[]>();
    for (let vertex = 0; vertex < positions.length; vertex += 3) {
      const key = `${positions[vertex].toFixed(4)},${positions[vertex + 2].toFixed(4)}`;
      heightsAt.set(key, [...(heightsAt.get(key) ?? []), positions[vertex + 1]]);
    }
    let shared = 0;
    for (const heights of heightsAt.values()) {
      // Frontier skirts hang below the patch's outer edge; only the surface itself must agree.
      const top = Math.max(...heights);
      const surface = heights.filter((height) => height > top - 0.1);
      if (surface.length > 1) shared++;
      expect(top - Math.min(...surface)).toBeLessThan(1e-4);
    }
    expect(shared).toBeGreaterThan(100);
  });

  it("keeps every tile's middle where an army or a structure stands today", () => {
    const today = new TerrainField(request());
    const relief = new TerrainField(request("relief"));
    for (const cell of request().cells) {
      const { x, z } = terrainHexToWorld(cell.col, cell.row);
      expect(relief.sampleSurface(x, z).height).toBeCloseTo(today.sampleSurface(x, z).height, 6);
    }
  });

  it("gives each biome's tiles a landform the shipped tile does not have", () => {
    const today = new TerrainField(request());
    const relief = new TerrainField(request("relief"));
    const spread = (field: TerrainField) => {
      const heights: number[] = [];
      for (let step = 0; step < 400; step++)
        heights.push(field.sampleSurface(1 + (step % 20) * 0.2, 1 + Math.floor(step / 20) * 0.2).height);
      return Math.max(...heights) - Math.min(...heights);
    };
    expect(spread(relief)).toBeGreaterThan(spread(today) + 0.1);
  });
});
