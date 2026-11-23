import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types/terrain";
import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { afterEach, describe, expect, it } from "vitest";

import { setWorldOrigin } from "@/three/world-origin";

import { BIOME_MAP_SIZE, BIOMES_BY_ID, LAYER_BIOME_OFFSET, groundNumber, TerrainBiomeMap } from "./terrain-biome-map";
import { prepareTerrainPage } from "./terrain-page-builder";

const ZERO = { col: 0, row: 0 };
const FLAT_CLIMATE = () => ({ elevation: 0.4, moisture: 0.6 });

afterEach(() => setWorldOrigin(ZERO));

describe("the terrain's biome map", () => {
  it("holds each cell's biome, ground and climate round the map's floating origin", () => {
    const map = new TerrainBiomeMap();
    map.write(
      [
        { col: 131, row: 65, biome: BiomeType.Scorched },
        { col: 127, row: 62, biome: BiomeType.Taiga },
      ],
      { col: 128, row: 64 },
      (col) => (col === 131 ? { elevation: 0.8, moisture: 0.2 } : { elevation: 0.3, moisture: 0.7 }),
    );
    expect(map.read(3, 1)).toEqual({
      biome: BiomeTypeToId[BiomeType.Scorched],
      ground: groundNumber("ash"),
      climate: [Math.round(0.8 * 255) / 255, Math.round(0.2 * 255) / 255],
      written: true,
    });
    expect(map.read(-1, -2)).toEqual({
      biome: BiomeTypeToId[BiomeType.Taiga],
      ground: groundNumber("forest"),
      climate: [Math.round(0.3 * 255) / 255, Math.round(0.7 * 255) / 255],
      written: true,
    });
    expect(map.read(0, 0).written).toBe(false);
  });

  it("leaves a cell with no biome unwritten", () => {
    const map = new TerrainBiomeMap();
    map.write([{ col: 2, row: 2, biome: null }], ZERO, FLAT_CLIMATE);
    expect(map.read(2, 2).written).toBe(false);
  });

  it("reads a hex a whole map away at the same texel, so any window the map draws fits", () => {
    const map = new TerrainBiomeMap();
    map.write([{ col: 5, row: 7, biome: BiomeType.Beach }], ZERO, FLAT_CLIMATE);
    expect(map.read(5 + BIOME_MAP_SIZE, 7 - BIOME_MAP_SIZE).biome).toBe(BiomeTypeToId[BiomeType.Beach]);
  });

  it("indexes BIOMES_BY_ID directly by BiomeTypeToId for every BiomeType", () => {
    for (const biome of Object.values(BiomeType)) {
      const id = BiomeTypeToId[biome];
      expect(id).toBeLessThan(LAYER_BIOME_OFFSET);
      expect(BIOMES_BY_ID[id]).toBe(biome);
    }
  });

  it("keeps layer biome codes above LAYER_BIOME_OFFSET and skips layer cells during surface writes", () => {
    const map = new TerrainBiomeMap();
    map.writeLayers([{ col: 3, row: 2, surfacePresentation: 1 }], ZERO, 0, NEUTRAL_BIOME_CLIMATE);
    map.write(
      [
        { col: 3, row: 2, biome: BiomeType.Grassland, surfacePresentation: 1 },
        { col: 2, row: 2, biome: BiomeType.Grassland },
      ],
      ZERO,
      FLAT_CLIMATE,
    );

    const layerCell = map.read(3, 2);
    expect(layerCell.biome).toBeGreaterThan(LAYER_BIOME_OFFSET);
    expect(layerCell.ground).toBe(0);

    const surfaceCell = map.read(2, 2);
    expect(surfaceCell.biome).toBe(BiomeTypeToId[BiomeType.Grassland]);
  });
});

describe("a page's biomes", () => {
  it("lie under the page's own hexes when the map's origin moved while the page was built", () => {
    const biome = BiomeType.TemperateDesert;
    const cell = { col: 3, row: 2, biome, explored: true, occupied: false, previewBiome: biome };
    const page = prepareTerrainPage({
      cells: [cell],
      climate: NEUTRAL_BIOME_CLIMATE,
      halo: [],
      mapCenter: 0,
      pageKey: "realm-view",
      roadSegments: [],
      settlementAnchors: [],
      strictBiomeParity: false,
    });
    setWorldOrigin({ col: -1_236_511_808, row: -1_269_605_120 });
    const map = new TerrainBiomeMap();

    map.write(page.request.cells, page.origin, FLAT_CLIMATE);

    expect(page.origin).toEqual(ZERO);
    expect(map.read(3, 2)).toMatchObject({ biome: BiomeTypeToId[BiomeType.TemperateDesert], written: true });
  });
});
