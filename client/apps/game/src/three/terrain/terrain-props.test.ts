import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { TerrainField, type TerrainPropDensityContext } from "./terrain-field";
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
      { ...cell(2, 0, BiomeType.Grassland), biome: null },
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
    expect(instances.every(({ tint }) => tint.every((channel) => channel >= 0.88 && channel <= 1))).toBe(true);
  });
});

function cell(col: number, row: number, biome: BiomeType, occupied = false): TerrainCellInput {
  return { biome, col, occupied, row };
}

function request(cells: TerrainCellInput[], pageKey = "props", halo: TerrainCellInput[] = []): TerrainPageRequest {
  return {
    cells,
    climate: NEUTRAL_BIOME_CLIMATE,
    generation: 1,
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
    },
    normalY: overrides.normalY ?? 1,
  };
}
