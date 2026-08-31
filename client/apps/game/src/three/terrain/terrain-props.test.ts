import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { TerrainField, type TerrainPropDensityContext } from "./terrain-field";
import { getTerrainPropCanopyExclusionRadius, getTerrainPropPlacementLayer } from "./terrain-prop-catalog";
import { prepareTerrainPropInstances, resolveEffectiveTerrainPropDensity } from "./terrain-props";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";

describe("terrain prop placement", () => {
  it("is deterministic and independent of cell traversal order", () => {
    const cells = [cell(0, 0, BiomeType.TemperateRainForest), cell(1, 0, BiomeType.Taiga)];
    const forward = request(cells);
    const reverse = request([...cells].reverse());

    expect(prepareTerrainPropInstances(forward, new TerrainField(forward))).toEqual(
      prepareTerrainPropInstances(reverse, new TerrainField(reverse)),
    );
  });

  it("never places props in water, unexplored, or occupied cells", () => {
    const cells = [
      cell(0, 0, BiomeType.TropicalRainForest, true),
      cell(1, 0, BiomeType.Ocean),
      { ...cell(2, 0, BiomeType.Grassland), biome: null, explored: false },
    ];
    const page = request(cells);

    expect(prepareTerrainPropInstances(page, new TerrainField(page))).toEqual([]);
  });

  it("anchors candidates globally so splitting pages does not move accepted instances", () => {
    const firstCell = cell(0, 0, BiomeType.TropicalRainForest);
    const secondCell = cell(1, 0, BiomeType.TemperateDeciduousForest);
    const combined = request([firstCell, secondCell], "combined");
    const firstPage = request([firstCell], "first", [secondCell]);
    const secondPage = request([secondCell], "second", [firstCell]);
    const combinedInstances = prepareTerrainPropInstances(combined, new TerrainField(combined));
    const splitInstances = [
      ...prepareTerrainPropInstances(firstPage, new TerrainField(firstPage)),
      ...prepareTerrainPropInstances(secondPage, new TerrainField(secondPage)),
    ];

    expect(withoutPageKeys(splitInstances)).toEqual(withoutPageKeys(combinedInstances));
  });

  it("raises density on moist gentle patches and suppresses steep dry ground", () => {
    const favorable = densityContext({ elevation: 0.4, moisture: 0.82, normalY: 1, patchiness: 0.85 });
    const stressed = densityContext({ elevation: 0.88, moisture: 0.18, normalY: 0.92, patchiness: 0.15 });

    expect(
      resolveEffectiveTerrainPropDensity(BiomeType.TropicalRainForest, favorable.context, favorable.normalY),
    ).toBeGreaterThan(
      resolveEffectiveTerrainPropDensity(BiomeType.TropicalRainForest, stressed.context, stressed.normalY),
    );
  });

  it("blends neighboring biome densities and honors the clearance mask", () => {
    const pureGrassland = densityContext({
      biomeInfluences: [{ biome: BiomeType.Grassland, weight: 1 }],
    });
    const forestEdge = densityContext({
      biomeInfluences: [
        { biome: BiomeType.Grassland, weight: 0.5 },
        { biome: BiomeType.TropicalRainForest, weight: 0.5 },
      ],
    });

    expect(
      resolveEffectiveTerrainPropDensity(BiomeType.Grassland, forestEdge.context, forestEdge.normalY),
    ).toBeGreaterThan(
      resolveEffectiveTerrainPropDensity(BiomeType.Grassland, pureGrassland.context, pureGrassland.normalY),
    );
    expect(
      resolveEffectiveTerrainPropDensity(
        BiomeType.Grassland,
        { ...forestEdge.context, clearance: 0 },
        forestEdge.normalY,
      ),
    ).toBe(0);
  });

  it("applies and validates a deterministic global density multiplier", () => {
    const stressed = densityContext({ elevation: 0.75, moisture: 0.25, normalY: 0.97, patchiness: 0.3 });
    const baseline = resolveEffectiveTerrainPropDensity(
      BiomeType.TropicalRainForest,
      stressed.context,
      stressed.normalY,
    );

    expect(
      resolveEffectiveTerrainPropDensity(BiomeType.TropicalRainForest, stressed.context, stressed.normalY, 2),
    ).toBeCloseTo(baseline * 2);
    const invalid = { ...request([cell(0, 0, BiomeType.Grassland)]), propDensityMultiplier: 3.1 };
    expect(() => prepareTerrainPropInstances(invalid, new TerrainField(invalid))).toThrow(
      "Terrain prop density multiplier must be from 0.25 to 3",
    );
  });

  it("builds canopy, understory, and debris layers with bounded variation", () => {
    const cells = Array.from({ length: 100 }, (_, index) =>
      cell(index % 10, Math.floor(index / 10), BiomeType.TemperateRainForest),
    );
    const page = request(cells, "ecology");
    const instances = prepareTerrainPropInstances(page, new TerrainField(page));
    const archetypes = new Set(instances.map(({ archetype }) => archetype));

    expect([...archetypes].some((archetype) => ["willow", "broadleaf", "birch"].includes(archetype))).toBe(true);
    expect(archetypes.has("shrub")).toBe(true);
    expect(archetypes.has("fallen-log")).toBe(true);
    expect(Math.min(...instances.map(({ scale }) => scale))).toBeGreaterThanOrEqual(0.54);
    expect(Math.max(...instances.map(({ scale }) => scale))).toBeLessThanOrEqual(1.24);
    expect(
      instances.every(({ appearance }) => appearance.tint.every((channel) => channel >= 0.88 && channel <= 1)),
    ).toBe(true);
  });

  it("keeps canopy crowns apart without coupling understory or debris to their slots", () => {
    const cells = Array.from({ length: 100 }, (_, index) =>
      cell(index % 10, Math.floor(index / 10), BiomeType.TropicalRainForest),
    );
    const page = request(cells, "canopy-spacing");
    const instances = prepareTerrainPropInstances(page, new TerrainField(page));
    const canopy = instances.filter(({ archetype }) => getTerrainPropPlacementLayer(archetype) === "canopy");
    const layers = new Set(instances.map(({ archetype }) => getTerrainPropPlacementLayer(archetype)));

    expect(layers).toEqual(new Set(["canopy", "understory", "debris"]));
    for (let leftIndex = 0; leftIndex < canopy.length; leftIndex += 1) {
      const left = canopy[leftIndex]!;
      for (let rightIndex = leftIndex + 1; rightIndex < canopy.length; rightIndex += 1) {
        const right = canopy[rightIndex]!;
        const minimum =
          getTerrainPropCanopyExclusionRadius(left.archetype) * left.scale +
          getTerrainPropCanopyExclusionRadius(right.archetype) * right.scale;
        expect(Math.hypot(left.worldX - right.worldX, left.worldZ - right.worldZ)).toBeGreaterThanOrEqual(minimum);
      }
    }
  });

  it("grows larger mature crowns and biases regenerating gaps toward pioneer trees", () => {
    const cells = Array.from({ length: 225 }, (_, index) =>
      cell(index % 15, Math.floor(index / 15), BiomeType.TemperateDeciduousForest),
    );
    const page = request(cells, "forest-succession");
    const field = new TerrainField(page);
    const canopy = prepareTerrainPropInstances(page, field)
      .filter(({ archetype }) => getTerrainPropPlacementLayer(archetype) === "canopy")
      .map((instance) => ({
        ...instance,
        vegetation: field.sampleVegetationField(instance.worldX, instance.worldZ, {
          col: instance.ownerCol,
          row: instance.ownerRow,
        }),
      }));
    const sampleCount = Math.max(1, Math.floor(canopy.length * 0.3));
    const mature = canopy
      .toSorted((left, right) => right.vegetation.maturity - left.vegetation.maturity)
      .slice(0, sampleCount);
    const regenerating = canopy
      .toSorted((left, right) => right.vegetation.successionStrength - left.vegetation.successionStrength)
      .slice(0, sampleCount);

    expect(average(mature.map(({ scale }) => scale))).toBeGreaterThan(
      average(regenerating.map(({ scale }) => scale)) + 0.04,
    );
    expect(fraction(regenerating, "birch")).toBeGreaterThan(fraction(mature, "birch"));
  });

  it("carries climate-conditioned moss, snow, and wind presentation into the shared prop pools", () => {
    const snowyCells = Array.from({ length: 100 }, (_, index) =>
      cell(index % 10, Math.floor(index / 10), BiomeType.Snow),
    );
    const rainforestCells = Array.from({ length: 100 }, (_, index) =>
      cell(index % 10, Math.floor(index / 10), BiomeType.TropicalRainForest),
    );
    const snowyRequest = request(snowyCells, "snowy-props");
    const rainforestRequest = request(rainforestCells, "rainforest-props");
    const snowy = prepareTerrainPropInstances(snowyRequest, new TerrainField(snowyRequest));
    const rainforest = prepareTerrainPropInstances(rainforestRequest, new TerrainField(rainforestRequest));

    expect(snowy.length).toBeGreaterThan(0);
    expect(rainforest.length).toBeGreaterThan(0);
    expect(average(snowy.map(({ appearance }) => appearance.snow))).toBeGreaterThan(0.55);
    expect(average(rainforest.map(({ appearance }) => appearance.moss))).toBeGreaterThan(
      average(snowy.map(({ appearance }) => appearance.moss)) + 0.15,
    );
    expect(average(rainforest.map(({ appearance }) => appearance.windAmplitude))).toBeGreaterThan(
      average(snowy.map(({ appearance }) => appearance.windAmplitude)) + 0.1,
    );
    expect(
      [...snowy, ...rainforest].every(({ appearance }) =>
        [appearance.moss, appearance.snow, appearance.windAmplitude].every((value) => value >= 0 && value <= 1),
      ),
    ).toBe(true);
  });
});

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function fraction(
  instances: readonly ReturnType<typeof prepareTerrainPropInstances>[number][],
  archetype: ReturnType<typeof prepareTerrainPropInstances>[number]["archetype"],
): number {
  return instances.filter((instance) => instance.archetype === archetype).length / instances.length;
}

function cell(col: number, row: number, biome: BiomeType, occupied = false): TerrainCellInput {
  return { biome, col, explored: true, occupied, previewBiome: biome, row };
}

function request(cells: TerrainCellInput[], pageKey = "props", halo: TerrainCellInput[] = []): TerrainPageRequest {
  return {
    cells,
    climate: NEUTRAL_BIOME_CLIMATE,
    halo,
    mapCenter: 0,
    pageKey,
    subdivisions: 1,
  };
}

function withoutPageKeys(instances: ReturnType<typeof prepareTerrainPropInstances>) {
  return instances
    .map((instance) => {
      const { pageKey, ...withoutPageKey } = instance;
      void pageKey;
      return withoutPageKey;
    })
    .toSorted((left, right) => left.worldZ - right.worldZ || left.worldX - right.worldX);
}

function densityContext(overrides: Partial<TerrainPropDensityContext> & { normalY?: number } = {}): {
  context: TerrainPropDensityContext;
  normalY: number;
} {
  return {
    context: {
      biomeInfluences: overrides.biomeInfluences ?? [{ biome: BiomeType.TropicalRainForest, weight: 1 }],
      clearance: overrides.clearance ?? 1,
      elevation: overrides.elevation ?? 0.45,
      moisture: overrides.moisture ?? 0.5,
      patchiness: overrides.patchiness ?? 0.5,
      canopyCover: overrides.canopyCover ?? 0.7,
      debrisCover: overrides.debrisCover ?? 0.25,
      edgeStrength: overrides.edgeStrength ?? 0.2,
      gapStrength: overrides.gapStrength ?? 0.2,
      maturity: overrides.maturity ?? 0.45,
      successionStrength: overrides.successionStrength ?? 0.3,
      understoryCover: overrides.understoryCover ?? 0.5,
    },
    normalY: overrides.normalY ?? 1,
  };
}
