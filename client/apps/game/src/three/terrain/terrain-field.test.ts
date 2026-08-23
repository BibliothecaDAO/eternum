import { Biome, NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";

import { findNearestTerrainHex, terrainHexToWorld } from "./terrain-coordinates";
import { TerrainField } from "./terrain-field";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";

describe("TerrainField", () => {
  it("is deterministic and keeps projected biome authoritative at cell centers", () => {
    const request = createRequest([cell(0, 0, BiomeType.Snow), cell(1, 0, BiomeType.TropicalRainForest)]);
    const field = new TerrainField(request);
    const center = terrainHexToWorld(0, 0);

    expect(field.sampleVisual(center.x, center.z)).toEqual(field.sampleVisual(center.x, center.z));
    expect(field.sampleVisual(center.x, center.z).biome).toBe(BiomeType.Snow);
    expect(field.getBiomeMismatchCount()).toBeGreaterThan(0);
  });

  it("produces identical shared-edge samples from adjacent page ownership", () => {
    const leftCell = cell(0, 0, BiomeType.Grassland);
    const rightCell = cell(1, 0, BiomeType.TemperateDeciduousForest);
    const left = new TerrainField(createRequest([leftCell], [rightCell], "left"));
    const right = new TerrainField(createRequest([rightCell], [leftCell], "right"));
    const leftCenter = terrainHexToWorld(0, 0);
    const rightCenter = terrainHexToWorld(1, 0);
    const sharedX = (leftCenter.x + rightCenter.x) / 2;
    const sharedZ = (leftCenter.z + rightCenter.z) / 2;
    const owner = findNearestTerrainHex(sharedX, sharedZ);

    expect(left.sampleSurface(sharedX, sharedZ)).toEqual(right.sampleSurface(sharedX, sharedZ));
    expect(left.samplePropDensityContext(sharedX, sharedZ, owner)).toEqual(
      right.samplePropDensityContext(sharedX, sharedZ, owner),
    );
  });

  it("blends climate and biome influence continuously across an edge", () => {
    const grassland = cell(0, 0, BiomeType.Grassland);
    const rainforest = cell(1, 0, BiomeType.TropicalRainForest);
    const field = new TerrainField(createRequest([grassland, rainforest]));
    const left = terrainHexToWorld(grassland.col, grassland.row);
    const right = terrainHexToWorld(rainforest.col, rainforest.row);
    const sample = field.samplePropDensityContext((left.x + right.x) / 2, (left.z + right.z) / 2, grassland);

    expect(sample.biomeInfluences).toHaveLength(2);
    expect(sample.biomeInfluences.reduce((total, influence) => total + influence.weight, 0)).toBeCloseTo(1, 12);
    expect(sample.moisture).toBeGreaterThanOrEqual(0);
    expect(sample.moisture).toBeLessThanOrEqual(1);
    expect(sample.patchiness).toBeGreaterThanOrEqual(0);
    expect(sample.patchiness).toBeLessThanOrEqual(1);
    const groundWeights = field.sampleVertex((left.x + right.x) / 2, (left.z + right.z) / 2).groundWeights;
    expect(groundWeights.reduce((total, weight) => total + weight, 0)).toBeCloseTo(1, 10);
  });

  it("creates a soft prop-clearance falloff around occupied cells", () => {
    const occupied = cell(0, 0, BiomeType.Bare, true);
    const neighbor = cell(1, 0, BiomeType.Grassland);
    const field = new TerrainField(createRequest([occupied, neighbor]));
    const occupiedCenter = terrainHexToWorld(occupied.col, occupied.row);
    const neighborCenter = terrainHexToWorld(neighbor.col, neighbor.row);
    const nearStructure = field.samplePropDensityContext(occupiedCenter.x + 0.9, occupiedCenter.z, neighbor);
    const openGround = field.samplePropDensityContext(neighborCenter.x, neighborCenter.z, neighbor);

    expect(nearStructure.clearance).toBeGreaterThan(0);
    expect(nearStructure.clearance).toBeLessThan(openGround.clearance);
    expect(openGround.clearance).toBe(1);
  });

  it("flattens an occupied center and keeps unknown space neutral", () => {
    const occupied = cell(0, 0, BiomeType.Bare, true);
    const field = new TerrainField(createRequest([occupied]));
    const center = terrainHexToWorld(0, 0);
    const centerHeight = field.sampleSurface(center.x, center.z).height;

    expect(field.sampleSurface(center.x + 0.3, center.z).height).toBeCloseTo(centerHeight, 10);
    expect(field.sampleSurface(20, 20).biome).toBeNull();
  });

  it("can make projected/environment mismatches fatal at the explicit production seam", () => {
    expect(() => new TerrainField({ ...createRequest([cell(0, 0, BiomeType.Snow)]), strictBiomeParity: true })).toThrow(
      "fixture has 1 projected biome/environment mismatch(es)",
    );
  });

  it("defers full-page biome parity sampling until diagnostics request it", () => {
    const sampleEnvironment = vi.spyOn(Biome, "sampleEnvironment");
    const field = new TerrainField(createRequest([cell(0, 0, BiomeType.Grassland)]));

    expect(sampleEnvironment).not.toHaveBeenCalled();
    field.getBiomeMismatchCount();
    expect(sampleEnvironment).toHaveBeenCalledOnce();
    sampleEnvironment.mockRestore();
  });
});

function cell(col: number, row: number, biome: BiomeType, occupied = false): TerrainCellInput {
  return { biome, col, occupied, row };
}

function createRequest(
  cells: TerrainCellInput[],
  halo: TerrainCellInput[] = [],
  pageKey = "fixture",
): TerrainPageRequest {
  return {
    cells,
    climate: NEUTRAL_BIOME_CLIMATE,
    generation: 1,
    halo,
    mapCenter: 0,
    pageKey,
    subdivisions: 3,
  };
}
