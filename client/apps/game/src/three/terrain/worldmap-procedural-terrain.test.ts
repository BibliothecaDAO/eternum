import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { WorldmapProceduralTerrain, buildWorldmapTerrainPageRequests } from "./worldmap-procedural-terrain";

describe("WorldmapProceduralTerrain", () => {
  it("partitions signed coordinates into pages with exact one-ring halos", () => {
    const requests = buildWorldmapTerrainPageRequests({
      cells: [worldCell(-1, 0, BiomeType.Grassland), worldCell(0, 0, BiomeType.Taiga), worldCell(1, 0, "Outline")],
      climate: NEUTRAL_BIOME_CLIMATE,
      generation: 1,
      mapCenter: 0,
      pageHeight: 2,
      pageWidth: 1,
      subdivisions: 1,
    });

    expect(requests.map(({ pageKey }) => pageKey)).toEqual(["0,-1", "0,0", "0,1"]);
    expect(requests[1].halo.map(({ col }) => col)).toEqual([-1, 1]);
    expect(requests[2].cells[0].biome).toBeNull();
  });

  it("propagates the explicit prop density into every prepared page", () => {
    const requests = buildWorldmapTerrainPageRequests({
      cells: [worldCell(0, 0, BiomeType.Grassland), worldCell(2, 0, BiomeType.Taiga)],
      generation: 1,
      mapCenter: 0,
      pageHeight: 1,
      pageWidth: 1,
      propDensityMultiplier: 1.5,
    });

    expect(requests.map(({ propDensityMultiplier }) => propDensityMultiplier)).toEqual([1.5, 1.5]);
  });

  it("reuses unchanged prepared pages and rebuilds only changed occupancy", () => {
    const terrain = new WorldmapProceduralTerrain();
    const input = {
      cells: [worldCell(0, 0, BiomeType.Beach)],
      climate: NEUTRAL_BIOME_CLIMATE,
      generation: 1,
      mapCenter: 0,
      pageHeight: 2,
      pageWidth: 2,
      subdivisions: 1,
    };

    expect(terrain.present(input)).toMatchObject({ builtPages: 1, commitMs: expect.any(Number), reusedPages: 0 });
    expect(terrain.present(input)).toMatchObject({ builtPages: 0, commitMs: expect.any(Number), reusedPages: 1 });
    expect(terrain.present({ ...input, cells: [{ ...input.cells[0], occupied: true }] })).toMatchObject({
      builtPages: 1,
      reusedPages: 0,
    });
    terrain.dispose();
  });
});

function worldCell(col: number, row: number, biomeKey: string) {
  return { biomeKey, col, occupied: false, row };
}
