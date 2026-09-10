import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { createHexceptionTerrainRequest, getLocalHexDisk } from "../scenes/hexception-terrain";
import { createLocalTerrainLabRequest } from "../debug/local-terrain-lab";
import { buildTerrainLabRequest, DEFAULT_TERRAIN_LAB_PREVIEW } from "../debug/terrain-lab-preview";
import { TerrainField } from "./terrain-field";
import { prepareTerrainPage } from "./terrain-page-builder";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";
import { TERRAIN_WATER_LEVEL } from "./terrain-water";

describe("settlement ground", () => {
  it.each([StructureType.Camp, StructureType.Village, StructureType.Realm])(
    "reclaims an island for structure %s and preserves surrounding water",
    (structureType) => {
      const cells = getLocalHexDisk({ col: 0, row: 0 }, 2).map(({ col, row }) => cell(col, row, BiomeType.DeepOcean));
      const source = request(cells, structureType);
      const original = structuredClone(source);
      const page = prepareTerrainPage(source);
      const field = new TerrainField(page.request);
      expect(field.sampleSurface(0, 0).biome).toBe(BiomeType.Beach);
      expect(field.sampleSurface(0, 0).height).toBeGreaterThan(TERRAIN_WATER_LEVEL);
      expect(page.request.cells.filter((cell) => cell.biome === BiomeType.Beach)).toHaveLength(1);
      expect(page.waterBuffers?.positions.length).toBeGreaterThan(0);
      expect(source).toEqual(original);
      expect(prepareTerrainPage({ ...source, settlementAnchors: [] }).request.cells).toEqual(cells);
    },
  );

  it.each([StructureType.Camp, StructureType.Village, StructureType.Realm])(
    "preserves biome materials beneath structure %s while clearing props",
    (structureType) => {
      for (const biome of [BiomeType.Grassland, BiomeType.Snow, BiomeType.Beach, BiomeType.TropicalRainForest]) {
        const cells = getLocalHexDisk({ col: 0, row: 0 }, 2).map(({ col, row }) => cell(col, row, biome));
        const settled = new TerrainField(prepareTerrainPage(request(cells, structureType)).request);
        const natural = new TerrainField({
          ...request(
            cells.map((cell) => ({ ...cell, occupied: false })),
            structureType,
          ),
          settlementAnchors: [],
        });
        for (const x of [0, 0.4, 1.2]) {
          expect(settled.sampleVisual(x, 0).groundWeights).toEqual(natural.sampleVisual(x, 0).groundWeights);
          expect(settled.sampleVisual(x, 0).color).toEqual(natural.sampleVisual(x, 0).color);
        }
        expect(settled.samplePropDensityContext(0, 0, cells[0]).clearance).toBeLessThan(
          natural.samplePropDensityContext(0, 0, cells[0]).clearance,
        );
      }
    },
  );

  it("keeps land biomes, other structures and hidden cells intact", () => {
    for (const biome of [
      BiomeType.Grassland,
      BiomeType.Snow,
      BiomeType.TropicalRainForest,
      BiomeType.TemperateDesert,
    ]) {
      const source = request([cell(0, 0, biome)], StructureType.Village);
      expect(prepareTerrainPage(source).request.cells).toEqual(source.cells);
    }
    const mine = request([cell(0, 0, BiomeType.Ocean)], StructureType.FragmentMine);
    expect(prepareTerrainPage(mine).request.cells[0].biome).toBe(BiomeType.Ocean);
    const hidden = request([{ ...cell(0, 0, BiomeType.Ocean), biome: null, explored: false }], StructureType.Camp);
    const page = prepareTerrainPage(hidden);
    expect(page.request.cells[0].biome).toBeNull();
    expect(page.buffers.positions).toHaveLength(0);
  });

  it("uses identical island ground when the settlement is a neighbor in the page halo", () => {
    const source = request([cell(1, 0, BiomeType.Ocean)], StructureType.Village);
    source.halo = [cell(0, 0, BiomeType.Ocean)];
    expect(prepareTerrainPage(source).request.halo[0].biome).toBe(BiomeType.Beach);
  });

  it.each([BiomeType.Ocean, BiomeType.DeepOcean])(
    "uses sand throughout local %s terrain, including unbuilt tiles and lab previews",
    (biome) => {
      const cells = [cell(0, 0, biome), { ...cell(1, 0, biome), occupied: false }, cell(2, 0, BiomeType.Snow)];
      const local = createHexceptionTerrainRequest(cells, NEUTRAL_BIOME_CLIMATE, "local-water");
      expect(local.cells.map((cell) => cell.biome)).toEqual([BiomeType.Beach, BiomeType.Beach, BiomeType.Snow]);
      expect(cells[0].biome).toBe(biome);
      const preview = buildTerrainLabRequest(
        createLocalTerrainLabRequest(1),
        { ...DEFAULT_TERRAIN_LAB_PREVIEW, biome },
        { col: 0, row: 0 },
        [],
        true,
      );
      expect(preview.cells.every((cell) => cell.biome === BiomeType.Beach)).toBe(true);
      expect(prepareTerrainPage(preview).waterBuffers).toBeNull();
    },
  );
});

function cell(col: number, row: number, biome: BiomeType): TerrainCellInput {
  return { col, row, biome, previewBiome: biome, explored: true, occupied: col === 0 && row === 0 };
}

function request(cells: TerrainCellInput[], structureType: StructureType): TerrainPageRequest {
  return {
    cells,
    halo: [],
    climate: NEUTRAL_BIOME_CLIMATE,
    mapCenter: 0,
    pageKey: "settlement-ground",
    roadSegments: [],
    settlementAnchors: [{ col: 0, row: 0, level: 0, structureId: "settlement", structureType }],
  };
}
