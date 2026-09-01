import { Biome, NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, StructureType } from "@bibliothecadao/types";
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
    expect(left.sampleVegetationField(sharedX, sharedZ, owner)).toEqual(
      right.sampleVegetationField(sharedX, sharedZ, owner),
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

  it("derives canopy, understory, debris, and gaps from one deterministic vegetation field", () => {
    const rainforest = cell(0, 0, BiomeType.TropicalRainForest);
    const grassland = cell(3, 0, BiomeType.Grassland);
    const field = new TerrainField(createRequest([rainforest, grassland]));
    const forestCenter = terrainHexToWorld(rainforest.col, rainforest.row);
    const grassCenter = terrainHexToWorld(grassland.col, grassland.row);
    const forest = field.sampleVegetationField(forestCenter.x, forestCenter.z, rainforest);
    const open = field.sampleVegetationField(grassCenter.x, grassCenter.z, grassland);

    expect(field.sampleVegetationField(forestCenter.x, forestCenter.z, rainforest)).toEqual(forest);
    expect(forest.canopyCover).toBeGreaterThan(open.canopyCover);
    expect(forest.debrisCover).toBeGreaterThan(open.debrisCover);
    expect(Object.values(forest).every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("distinguishes mature forest interiors from regenerating biome edges", () => {
    const rainforest = cell(0, 0, BiomeType.TropicalRainForest);
    const grassland = cell(1, 0, BiomeType.Grassland);
    const forestField = new TerrainField(createRequest([rainforest]));
    const edgeField = new TerrainField(createRequest([rainforest, grassland]));
    const forestCenter = terrainHexToWorld(rainforest.col, rainforest.row);
    const grassCenter = terrainHexToWorld(grassland.col, grassland.row);
    const edgePoint = {
      x: (forestCenter.x + grassCenter.x) / 2,
      z: (forestCenter.z + grassCenter.z) / 2,
    };
    const interior = forestField.sampleVegetationField(forestCenter.x, forestCenter.z, rainforest);
    const edge = edgeField.sampleVegetationField(edgePoint.x, edgePoint.z, rainforest);

    expect(edge.edgeStrength).toBeGreaterThan(interior.edgeStrength);
    expect(edge.successionStrength).toBeGreaterThan(interior.successionStrength);
    expect(interior.maturity).toBeGreaterThan(0);
    expect(Object.values(edge).every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("uses the vegetation field to darken the floor beneath dense forest", () => {
    const rainforest = cell(0, 0, BiomeType.TropicalRainForest);
    const grassland = cell(3, 0, BiomeType.Grassland);
    const forestField = new TerrainField(createRequest([rainforest]));
    const openField = new TerrainField(createRequest([grassland]));
    const forestCenter = terrainHexToWorld(rainforest.col, rainforest.row);
    const grassCenter = terrainHexToWorld(grassland.col, grassland.row);
    const forestGround = forestField.sampleVertex(forestCenter.x, forestCenter.z).groundWeights;
    const openGround = openField.sampleVertex(grassCenter.x, grassCenter.z).groundWeights;

    expect(forestGround[4]).toBeGreaterThan(openGround[4]);
    expect(forestGround[3]).toBeLessThan(openGround[3]);
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

  it("turns routed ground into a compact vegetation-free road corridor", () => {
    const cells = Array.from({ length: 5 }, (_, col) => cell(col, 0, BiomeType.Grassland));
    const start = terrainHexToWorld(0, 0);
    const end = terrainHexToWorld(4, 0);
    const request = {
      ...createRequest(cells),
      roadSegments: [{ end: [end.x, end.z] as const, routeId: "west:east", start: [start.x, start.z] as const }],
    };
    const field = new TerrainField(request);
    const center = terrainHexToWorld(2, 0);
    const road = field.sampleVertex(center.x, center.z);
    const open = field.sampleVertex(center.x, center.z + 0.9);
    const roadDensity = field.samplePropDensityContext(center.x, center.z, cells[2]);
    const vergeDensity = field.samplePropDensityContext(center.x, center.z + 0.82, cells[2]);
    const naturalDensity = field.samplePropDensityContext(center.x, center.z + 1.5, cells[2]);

    expect(road.groundWeights[1]).toBeGreaterThan(open.groundWeights[1]);
    expect(road.groundWeights[3]).toBeLessThan(open.groundWeights[3]);
    expect(roadDensity.clearance).toBe(0);
    expect(vergeDensity.roadEdgeStrength).toBeGreaterThan(0.8);
    expect(vergeDensity.successionStrength).toBeGreaterThan(naturalDensity.successionStrength);
    expect(naturalDensity.roadEdgeStrength).toBe(0);
  });

  it("creates a pioneer regrowth ring beyond an occupied settlement core", () => {
    const occupiedCells = Array.from({ length: 5 }, (_, col) =>
      cell(col, 0, BiomeType.TemperateDeciduousForest, col === 0),
    );
    const openCells = occupiedCells.map((candidate) => ({ ...candidate, occupied: false }));
    const occupiedField = new TerrainField(createRequest(occupiedCells));
    const openField = new TerrainField(createRequest(openCells));
    const settlement = terrainHexToWorld(0, 0);
    const ringPoint = { x: settlement.x + 1.45, z: settlement.z };
    const regrowth = occupiedField.samplePropDensityContext(ringPoint.x, ringPoint.z, occupiedCells[1]);
    const undisturbed = openField.samplePropDensityContext(ringPoint.x, ringPoint.z, openCells[1]);
    const regrowthGround = occupiedField.sampleVertex(ringPoint.x, ringPoint.z).groundWeights;
    const openGround = openField.sampleVertex(ringPoint.x, ringPoint.z).groundWeights;
    const regrowthColor = occupiedField.sampleVertex(ringPoint.x, ringPoint.z).color;
    const openColor = openField.sampleVertex(ringPoint.x, ringPoint.z).color;

    expect(regrowth.settlementEdgeStrength).toBeGreaterThan(0.35);
    expect(regrowth.disturbanceStrength).toBeGreaterThan(0.2);
    expect(regrowth.successionStrength).toBeGreaterThan(undisturbed.successionStrength + 0.2);
    expect(regrowth.maturity).toBeLessThan(undisturbed.maturity);
    expect(regrowthGround[1]).toBeGreaterThan(openGround[1]);
    expect(regrowthColor[0]).toBeGreaterThan(openColor[0]);
  });

  it("expands the settlement ecology footprint for higher-level Realms", () => {
    const cells = Array.from({ length: 5 }, (_, col) => cell(col, 0, BiomeType.TemperateDeciduousForest, col === 0));
    const settlementRequest = createRequest(cells);
    const empireRequest = {
      ...settlementRequest,
      settlementAnchors: settlementRequest.settlementAnchors.map((anchor) => ({ ...anchor, level: 4 })),
    };
    const center = terrainHexToWorld(0, 0);
    const samplePoint = { x: center.x + 2.05, z: center.z };
    const settlement = new TerrainField(settlementRequest).samplePropDensityContext(
      samplePoint.x,
      samplePoint.z,
      cells[1],
    );
    const empire = new TerrainField(empireRequest).samplePropDensityContext(samplePoint.x, samplePoint.z, cells[1]);

    expect(empire.settlementEdgeStrength).toBeGreaterThan(settlement.settlementEdgeStrength);
    expect(empire.disturbanceStrength).toBeGreaterThan(settlement.disturbanceStrength);
  });

  it("creates a moist succession fringe on land beside water", () => {
    const water = cell(0, 0, BiomeType.Ocean);
    const shore = cell(1, 0, BiomeType.TemperateRainForest);
    const inland = [2, 3, 4].map((col) => cell(col, 0, BiomeType.TemperateRainForest));
    const field = new TerrainField(createRequest([water, shore, ...inland]));
    const waterCenter = terrainHexToWorld(0, 0);
    const shoreCenter = terrainHexToWorld(1, 0);
    const edge = field.samplePropDensityContext(
      (waterCenter.x + shoreCenter.x) / 2,
      (waterCenter.z + shoreCenter.z) / 2,
      shore,
    );
    const inlandCenter = terrainHexToWorld(3, 0);
    const dryInterior = field.samplePropDensityContext(inlandCenter.x, inlandCenter.z, inland[1]);

    expect(edge.waterEdgeStrength).toBeGreaterThan(0.6);
    expect(edge.waterEdgeStrength).toBeGreaterThan(dryInterior.waterEdgeStrength);
    expect(edge.understoryCover).toBeGreaterThan(dryInterior.understoryCover);
  });

  it("adds deterministic macro landforms without breaking biome ownership", () => {
    const cells = Array.from({ length: 8 }, (_, col) => cell(col, 0, BiomeType.Scorched));
    const first = new TerrainField(createRequest(cells));
    const second = new TerrainField(createRequest(cells));
    const heights = cells.map(({ col, row }) => {
      const center = terrainHexToWorld(col, row);
      const sample = first.sampleSurface(center.x, center.z);
      expect(sample).toEqual(second.sampleSurface(center.x, center.z));
      expect(sample.biome).toBe(BiomeType.Scorched);
      return sample.height;
    });

    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.08);
  });

  it("exposes a continuous shoreline signal only where land meets water", () => {
    const cells = [
      cell(0, 0, BiomeType.Ocean),
      cell(1, 0, BiomeType.Beach),
      cell(2, 0, BiomeType.Grassland),
      cell(3, 0, BiomeType.Grassland),
      cell(4, 0, BiomeType.Grassland),
    ];
    const field = new TerrainField(createRequest(cells));
    const ocean = terrainHexToWorld(0, 0);
    const beach = terrainHexToWorld(1, 0);
    const coast = { x: (ocean.x + beach.x) / 2, z: (ocean.z + beach.z) / 2 };
    const inland = terrainHexToWorld(4, 0);

    expect(field.sampleVertex(coast.x, coast.z).shore).toBeGreaterThan(0.4);
    expect(field.sampleVertex(inland.x, inland.z).shore).toBe(0);
  });

  it("flattens an occupied center and keeps unknown space neutral", () => {
    const occupied = cell(0, 0, BiomeType.Bare, true);
    const field = new TerrainField(createRequest([occupied]));
    const center = terrainHexToWorld(0, 0);
    const centerHeight = field.sampleSurface(center.x, center.z).height;

    expect(field.sampleSurface(center.x + 0.3, center.z).height).toBeCloseTo(centerHeight, 10);
    expect(field.sampleSurface(20, 20).biome).toBeNull();
  });

  it("samples deterministic biome terrain beneath every fog-covered cell", () => {
    const frontier = unknownCell(1, 0, BiomeType.Snow);
    const underFog = unknownCell(2, 0, BiomeType.Scorched);
    const deep = unknownCell(3, 0, BiomeType.Bare);
    const field = new TerrainField(createRequest([cell(0, 0, BiomeType.Grassland), frontier, underFog, deep]));
    const frontierCenter = terrainHexToWorld(frontier.col, frontier.row);
    const underFogCenter = terrainHexToWorld(underFog.col, underFog.row);
    const deepCenter = terrainHexToWorld(deep.col, deep.row);

    expect(field.isFrontierCell(frontier.col, frontier.row)).toBe(true);
    expect(field.sampleFogPreviewVertex(frontierCenter.x, frontierCenter.z, frontier)).toMatchObject({
      biome: BiomeType.Snow,
      explored: 0,
    });
    expect(field.sampleFogPreviewVertex(underFogCenter.x, underFogCenter.z, underFog)).toMatchObject({
      biome: BiomeType.Scorched,
      explored: 0,
    });
    expect(field.isFrontierCell(deep.col, deep.row)).toBe(false);
    expect(field.sampleFogPreviewVertex(deepCenter.x, deepCenter.z, deep)).toMatchObject({
      biome: BiomeType.Bare,
      explored: 0,
    });
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
  return { biome, col, explored: true, occupied, previewBiome: biome, row };
}

function unknownCell(col: number, row: number, previewBiome: BiomeType): TerrainCellInput {
  return { biome: null, col, explored: false, occupied: false, previewBiome, row };
}

function createRequest(
  cells: TerrainCellInput[],
  halo: TerrainCellInput[] = [],
  pageKey = "fixture",
): TerrainPageRequest {
  return {
    cells,
    climate: NEUTRAL_BIOME_CLIMATE,
    halo,
    mapCenter: 0,
    pageKey,
    roadSegments: [],
    settlementAnchors: cells
      .filter(({ occupied }) => occupied)
      .map(({ col, row }) => ({
        col,
        level: 1,
        row,
        structureId: `fixture:${col}:${row}`,
        structureType: StructureType.Realm,
      })),
    subdivisions: 3,
  };
}
