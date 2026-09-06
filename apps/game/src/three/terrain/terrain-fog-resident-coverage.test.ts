import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { terrainHexCorners, terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import { prepareTerrainPage } from "./terrain-page-builder";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";

// Resident geometry contains only revealed hexes; the separate backdrop owns every unknown hex.
// Revealed geometry must reach its exact edges so the backdrop cannot eat into playable ground.
describe("resident fog coverage", () => {
  it.each([BiomeType.Scorched, BiomeType.Grassland, BiomeType.Ocean])(
    "keeps the entire revealed %s hex clear beside six unknown neighbors",
    (biome) => {
      for (const row of [-1, 0, 1]) {
        const page = prepareTerrainPage(request(2, row, biome, true));
        const center = terrainHexToWorld(2, row);
        const corners = terrainHexCorners(2, row);
        const edges = corners.map((corner, index) => {
          const next = corners[(index + 1) % corners.length];
          return { x: (corner.x + next.x) / 2, z: (corner.z + next.z) / 2 };
        });
        for (const point of [center, ...corners, ...edges]) {
          const vertices = Array.from(page.buffers.explored.keys()).filter((index) => {
            const x = page.buffers.positions[index * 3];
            const z = page.buffers.positions[index * 3 + 2];
            return Math.abs(x - point.x) < 0.000_002 && Math.abs(z - point.z) < 0.000_002;
          });
          expect(vertices.length).toBeGreaterThan(0);
          expect(vertices.every((index) => page.buffers.explored[index] === 1)).toBe(true);
        }
        expect(new Set(page.buffers.explored)).toEqual(new Set([1]));
        if (page.waterBuffers) expect(new Set(page.waterBuffers.explored)).toEqual(new Set([1]));
      }
    },
  );

  it("creates the whole resident hex only when its exploration commits", () => {
    const before = request(0, 0, BiomeType.Scorched, false);
    const hidden = prepareTerrainPage(before);
    const after = prepareTerrainPage({ ...before, cells: [cell(0, 0, BiomeType.Scorched, true)] });
    expect(hidden.buffers.positions).toHaveLength(0);
    expect(hidden.waterBuffers).toBeNull();
    expect(hidden.shroudInstances).toHaveLength(1);
    expect(new Set(after.buffers.explored)).toEqual(new Set([1]));
  });
});

function request(col: number, row: number, biome: BiomeType, explored: boolean): TerrainPageRequest {
  return {
    cells: [cell(col, row, biome, explored)],
    climate: NEUTRAL_BIOME_CLIMATE,
    halo: terrainNeighborCoordinates(col, row).map((neighbor) => cell(neighbor.col, neighbor.row, biome, !explored)),
    mapCenter: 0,
    pageKey: "fog-boundary-fixture",
    roadSegments: [],
    settlementAnchors: [],
    subdivisions: 4,
  };
}

function cell(col: number, row: number, biome: BiomeType, explored: boolean): TerrainCellInput {
  return { biome: explored ? biome : null, col, row, explored, occupied: false, previewBiome: biome };
}
