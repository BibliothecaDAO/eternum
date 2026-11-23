import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types/terrain";
import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { afterEach, describe, expect, it } from "vitest";

import { setWorldOrigin } from "@/three/world-origin";

import { BIOME_MAP_SIZE, BIOMES_BY_ID, LAYER_BIOME_OFFSET, groundNumber, TerrainBiomeMap } from "./terrain-biome-map";
import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import { prepareTerrainPage } from "./terrain-page-builder";

const ZERO = { col: 0, row: 0 };

function decodeBorderDirection(borderLean: number): { x: number; z: number } {
  const angle = ((borderLean - 1) / 254) * Math.PI * 2 - Math.PI;
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

function unitDirection(from: { col: number; row: number }, to: { col: number; row: number }): { x: number; z: number } {
  const origin = terrainHexToWorld(from.col, from.row);
  const target = terrainHexToWorld(to.col, to.row);
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const length = Math.hypot(dx, dz);
  return { x: dx / length, z: dz / length };
}

afterEach(() => setWorldOrigin(ZERO));

describe("the terrain's biome map", () => {
  it("holds each cell's biome, ground and baked border lean round the map's floating origin", () => {
    const map = new TerrainBiomeMap();
    map.write(
      [
        { col: 131, row: 65, biome: BiomeType.Scorched },
        { col: 127, row: 62, biome: BiomeType.Taiga },
      ],
      { col: 128, row: 64 },
    );
    expect(map.read(3, 1)).toEqual({
      biome: BiomeTypeToId[BiomeType.Scorched],
      ground: groundNumber("ash"),
      borderBiome: 0,
      borderLean: 0,
      written: true,
    });
    expect(map.read(-1, -2)).toEqual({
      biome: BiomeTypeToId[BiomeType.Taiga],
      ground: groundNumber("forest"),
      borderBiome: 0,
      borderLean: 0,
      written: true,
    });
    expect(map.read(0, 0).written).toBe(false);
  });

  it("bakes border biome and lean direction toward the border biome's neighbours", () => {
    const map = new TerrainBiomeMap();
    map.write(
      [
        { col: 2, row: 2, biome: BiomeType.Scorched },
        { col: 3, row: 2, biome: BiomeType.Grassland },
      ],
      ZERO,
    );
    const scorched = map.read(2, 2);
    const grass = map.read(3, 2);
    expect(scorched.borderBiome).toBe(BiomeTypeToId[BiomeType.Grassland]);
    expect(grass.borderBiome).toBe(BiomeTypeToId[BiomeType.Scorched]);
    const scorchedLean = decodeBorderDirection(scorched.borderLean);
    const towardGrass = unitDirection({ col: 2, row: 2 }, { col: 3, row: 2 });
    expect(scorchedLean.x * towardGrass.x + scorchedLean.z * towardGrass.z).toBeGreaterThan(0.99);
    const grassLean = decodeBorderDirection(grass.borderLean);
    const towardScorched = unitDirection({ col: 3, row: 2 }, { col: 2, row: 2 });
    expect(grassLean.x * towardScorched.x + grassLean.z * towardScorched.z).toBeGreaterThan(0.99);
  });

  it("aims border lean strictly toward the winning borderBiome even when lower-id neighbours lie on opposite sides", () => {
    const map = new TerrainBiomeMap();
    const center = { col: 4, row: 2 };
    const centerWorld = terrainHexToWorld(center.col, center.row);
    const neighbors = terrainNeighborCoordinates(center.col, center.row).map((hex) => {
      const world = terrainHexToWorld(hex.col, hex.row);
      return { hex, dx: world.x - centerWorld.x, dz: world.z - centerWorld.z };
    });
    const west = neighbors.toSorted((a, b) => a.dx - b.dx)[0]!.hex;
    const eastAndSouth = neighbors
      .filter(({ hex, dx, dz }) => !(hex.col === west.col && hex.row === west.row) && (dx > 0.1 || dz > 0.1))
      .map(({ hex }) => hex);
    expect(eastAndSouth.length).toBeGreaterThanOrEqual(3);
    map.write(
      [
        { ...center, biome: BiomeType.Grassland },
        { ...west, biome: BiomeType.TropicalRainForest },
        ...eastAndSouth.map((hex) => ({ ...hex, biome: BiomeType.Beach })),
      ],
      ZERO,
    );
    const cell = map.read(center.col, center.row);
    expect(cell.borderBiome).toBe(BiomeTypeToId[BiomeType.TropicalRainForest]);
    const lean = decodeBorderDirection(cell.borderLean);
    const towardWest = unitDirection(center, west);
    expect(lean.x * towardWest.x + lean.z * towardWest.z).toBeGreaterThan(0.99);
  });

  it("leaves a cell with no biome unwritten", () => {
    const map = new TerrainBiomeMap();
    map.write([{ col: 2, row: 2, biome: null }], ZERO);
    expect(map.read(2, 2).written).toBe(false);
  });

  it("reads a hex a whole map away at the same texel, so any window the map draws fits", () => {
    const map = new TerrainBiomeMap();
    map.write([{ col: 5, row: 7, biome: BiomeType.Beach }], ZERO);
    expect(map.read(5 + BIOME_MAP_SIZE, 7 - BIOME_MAP_SIZE).biome).toBe(BiomeTypeToId[BiomeType.Beach]);
  });

  it("indexes BIOMES_BY_ID directly by BiomeTypeToId for every BiomeType", () => {
    for (const biome of Object.values(BiomeType)) {
      const id = BiomeTypeToId[biome];
      expect(id).toBeLessThan(LAYER_BIOME_OFFSET);
      expect(BIOMES_BY_ID[id]).toBe(biome);
    }
  });

  it("keeps layer biome codes above LAYER_BIOME_OFFSET and isolated from surface border baking", () => {
    const map = new TerrainBiomeMap();
    map.writeLayers([{ col: 3, row: 2, surfacePresentation: 1 }], ZERO, 0, NEUTRAL_BIOME_CLIMATE);
    map.write([{ col: 2, row: 2, biome: BiomeType.Grassland }], ZERO);

    const layerCell = map.read(3, 2);
    expect(layerCell.biome).toBeGreaterThan(LAYER_BIOME_OFFSET);
    expect(layerCell.ground).toBe(0);
    expect(layerCell.borderBiome).toBe(0);
    expect(layerCell.borderLean).toBe(0);

    const surfaceCell = map.read(2, 2);
    expect(surfaceCell.biome).toBe(BiomeTypeToId[BiomeType.Grassland]);
    expect(surfaceCell.borderBiome).toBe(0);
    expect(surfaceCell.borderLean).toBe(0);
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

    map.write(page.request.cells, page.origin);

    expect(page.origin).toEqual(ZERO);
    expect(map.read(3, 2)).toMatchObject({ biome: BiomeTypeToId[BiomeType.TemperateDesert], written: true });
  });
});
