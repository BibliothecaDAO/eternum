import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { TerrainField, type TerrainPropDensityContext } from "./terrain-field";
import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import {
  getTerrainPropFootprintRadius,
  getTerrainPropSpacingRadius,
  getTerrainPropDisturbanceAffinity,
  getTerrainPropPlacementLayer,
  LAYER_PROP_IDS,
  SURFACE_PROP_IDS,
  type TerrainPropArchetypeId,
} from "./terrain-prop-catalog";
import { LAYER_BIOME_LOOKS, layerBiomeAt } from "./layer-biomes";
import { TERRAIN_ARMY_ROUTE_HALF_WIDTH } from "./terrain-army-clearance";
import { getLayerPropBiomes, prepareTerrainPropInstances, resolveEffectiveTerrainPropDensity } from "./terrain-props";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";

describe("terrain prop placement", () => {
  it("keeps stable prop bases off army destinations and center-to-neighbor routes", () => {
    for (const biome of [BiomeType.Scorched, BiomeType.TropicalRainForest, BiomeType.Grassland]) {
      const cells = Array.from({ length: 400 }, (_, index) =>
        cell((index % 20) - 10, Math.floor(index / 20) - 10, biome),
      );
      const page = request(cells, "army-clearance");
      const instances = prepareTerrainPropInstances(page, new TerrainField(page));
      expect(instances.length).toBeGreaterThan(10);
      for (const prop of instances) {
        const center = terrainHexToWorld(prop.ownerCol, prop.ownerRow);
        const x = prop.worldX - center.x;
        const z = prop.worldZ - center.z;
        expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(0.34);
        for (let direction = 0; direction < 3; direction++) {
          const angle = (direction * Math.PI) / 3;
          expect(Math.abs(x * Math.sin(angle) - z * Math.cos(angle))).toBeGreaterThanOrEqual(0.22 - 1e-9);
        }
      }
    }
  });

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

  it("keeps scorched terrain barren across its full ecology placement pipeline", () => {
    const cells = Array.from({ length: 64 }, (_, index) => cell(index % 8, Math.floor(index / 8), BiomeType.Scorched));
    const page = request(cells, "scorched-identity");
    const instances = prepareTerrainPropInstances(page, new TerrainField(page));
    expect(instances.length).toBeGreaterThan(0);
    expect(instances.every(({ archetype }) => ["dead-tree", "boulder", "fallen-log"].includes(archetype))).toBe(true);
  });

  it("derives near-view ground cover of more than one kind from the same vegetation field", () => {
    const cells = Array.from({ length: 100 }, (_, index) =>
      cell(index % 10, Math.floor(index / 10), BiomeType.Grassland),
    );
    const terrainRequest = request(cells, "ground-cover");
    const instances = prepareTerrainPropInstances(terrainRequest, new TerrainField(terrainRequest));
    const groundCover = instances.filter(({ archetype }) => getTerrainPropPlacementLayer(archetype) === "groundcover");

    expect(groundCover.length).toBeGreaterThan(0);
    expect(new Set(groundCover.map(({ archetype }) => archetype)).size).toBeGreaterThan(1);
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
    const sparseBiome = BiomeType.Snow;
    const baseline = resolveEffectiveTerrainPropDensity(sparseBiome, stressed.context, stressed.normalY);

    expect(baseline * 2).toBeLessThan(1);
    expect(resolveEffectiveTerrainPropDensity(sparseBiome, stressed.context, stressed.normalY, 2)).toBeCloseTo(
      baseline * 2,
    );
    const invalid = { ...request([cell(0, 0, BiomeType.Grassland)]), propDensityMultiplier: 3.1 };
    expect(() => prepareTerrainPropInstances(invalid, new TerrainField(invalid))).toThrow(
      "Terrain prop density multiplier must be from 0.1 to 3",
    );
  });

  it("builds canopy, understory, and debris layers with bounded variation", () => {
    const cells = Array.from({ length: 100 }, (_, index) =>
      cell(index % 10, Math.floor(index / 10), BiomeType.TemperateRainForest),
    );
    const page = request(cells, "ecology");
    const instances = prepareTerrainPropInstances(page, new TerrainField(page));
    const archetypes = new Set(instances.map(({ archetype }) => archetype));

    expect([...archetypes].some((archetype) => ["rainforest-canopy", "broadleaf", "birch"].includes(archetype))).toBe(
      true,
    );
    expect(archetypes.has("shrub")).toBe(true);
    expect(archetypes.has("fallen-log")).toBe(true);
    expect(Math.min(...instances.map(({ scale }) => scale))).toBeGreaterThanOrEqual(0.54);
    expect(Math.max(...instances.map(({ scale }) => scale))).toBeLessThanOrEqual(1.24);
    expect(
      instances.every(({ appearance }) =>
        appearance.tint.every((channel) => Number.isFinite(channel) && channel >= 0.25 && channel <= 2),
      ),
    ).toBe(true);
  });

  it("keeps every standing prop's footprint apart, trees by their crowns", () => {
    for (const biome of [BiomeType.TropicalRainForest, BiomeType.Taiga, BiomeType.Shrubland, BiomeType.Beach]) {
      for (const seed of [11, 23, 37]) {
        const page = seededRequest(block(12, biome), `spacing-${biome}-${seed}`, seed);
        const standing = prepareTerrainPropInstances(page, new TerrainField(page)).filter(
          ({ archetype }) => getTerrainPropPlacementLayer(archetype) !== "groundcover",
        );
        expect(standing.length).toBeGreaterThan(10);
        for (let leftIndex = 0; leftIndex < standing.length; leftIndex += 1) {
          const left = standing[leftIndex]!;
          for (let rightIndex = leftIndex + 1; rightIndex < standing.length; rightIndex += 1) {
            const right = standing[rightIndex]!;
            const minimum =
              getTerrainPropSpacingRadius(left.archetype) * left.scale +
              getTerrainPropSpacingRadius(right.archetype) * right.scale;
            expect(Math.hypot(left.worldX - right.worldX, left.worldZ - right.worldZ)).toBeGreaterThanOrEqual(
              minimum - 1e-9,
            );
          }
        }
      }
    }
  });

  it("keeps every footprint out of an occupied hex and every tree off the ring round it", () => {
    const neighbourSpacing = Math.hypot(
      terrainHexToWorld(1, 0).x - terrainHexToWorld(0, 0).x,
      terrainHexToWorld(1, 0).z - terrainHexToWorld(0, 0).z,
    );
    for (const biome of [BiomeType.TropicalRainForest, BiomeType.TemperateDeciduousForest, BiomeType.Beach]) {
      for (const seed of [11, 23, 37]) {
        const cells = block(12, biome).map((entry) =>
          (entry.col === 0 || entry.col === 1) && entry.row === 0 ? { ...entry, occupied: true } : entry,
        );
        const page = seededRequest(cells, `clearance-${biome}-${seed}`, seed);
        const occupied = cells.filter(({ occupied }) => occupied).map(({ col, row }) => terrainHexToWorld(col, row));
        const besideOccupied = new Set(
          cells
            .filter(({ occupied }) => occupied)
            .flatMap(({ col, row }) => terrainNeighborCoordinates(col, row).map((hex) => `${hex.col}:${hex.row}`)),
        );
        for (const prop of prepareTerrainPropInstances(page, new TerrainField(page))) {
          if (getTerrainPropPlacementLayer(prop.archetype) === "canopy") {
            expect(besideOccupied.has(`${prop.ownerCol}:${prop.ownerRow}`)).toBe(false);
          }
          for (const centre of occupied) {
            const distance = Math.hypot(prop.worldX - centre.x, prop.worldZ - centre.z);
            const isTree = getTerrainPropPlacementLayer(prop.archetype) === "canopy";
            const reach =
              (isTree ? getTerrainPropFootprintRadius(prop.archetype) : getTerrainPropSpacingRadius(prop.archetype)) *
              prop.scale;
            expect(distance - reach).toBeGreaterThanOrEqual(neighbourSpacing / 2 - 1e-9);
          }
        }
      }
    }
  });

  it("grows layer flora only on explored layer hexes, lit by the glow of each hex's layer biome", () => {
    const cells = block(12, BiomeType.Taiga).map((entry) => {
      if (entry.row < -2) return { ...entry, surfacePresentation: 2 as const };
      if (entry.row < 0)
        return { ...entry, surfacePresentation: 2 as const, explored: false, biome: null, previewBiome: null };
      if (entry.row < 2) return { ...entry, surfacePresentation: 1 as const };
      return entry;
    });
    const byKey = new Map(cells.map((entry) => [`${entry.col}:${entry.row}`, entry]));
    for (const seed of [11, 23, 37]) {
      const page = seededRequest(cells, `layers-${seed}`, seed);
      const props = prepareTerrainPropInstances(page, new TerrainField(page));
      const layerProps = props.filter(({ archetype }) => isLayerProp(archetype));
      expect(layerProps.length).toBeGreaterThan(0);
      for (const prop of props) {
        const owner = byKey.get(`${prop.ownerCol}:${prop.ownerRow}`)!;
        expect(owner.explored).toBe(true);
        if (!isLayerProp(prop.archetype)) {
          expect(owner.surfacePresentation).toBeUndefined();
          continue;
        }
        const layer = owner.surfacePresentation;
        if (layer !== 1 && layer !== 2) throw new Error(`layer prop ${prop.archetype} stands off the layers`);
        const biome = layerBiomeAt(layer, owner.col, owner.row, page.climate);
        expect(getLayerPropBiomes(layerProp(prop.archetype))).toContain(biome);
        expect(prop.appearance.glow).toEqual(linear(LAYER_BIOME_LOOKS[biome].glow));
        if (layer === 2) expect(prop.appearance.windAmplitude).toBe(0);
      }
    }
  });

  it("lays root arches on hex edges, each clear of the crossing through the edge's middle", () => {
    let arches = 0;
    for (const seed of [11, 23, 37]) {
      const cells = block(16, BiomeType.Grassland).map((entry) => ({ ...entry, surfacePresentation: 2 as const }));
      const page = seededRequest(cells, `root-arches-${seed}`, seed);
      for (const prop of prepareTerrainPropInstances(page, new TerrainField(page))) {
        if (prop.archetype !== "root-arch") continue;
        arches += 1;
        const owner = terrainHexToWorld(prop.ownerCol, prop.ownerRow);
        const edges = terrainNeighborCoordinates(prop.ownerCol, prop.ownerRow).map(({ col, row }) => {
          const neighbour = terrainHexToWorld(col, row);
          const spacing = Math.hypot(neighbour.x - owner.x, neighbour.z - owner.z);
          const middle = { x: (owner.x + neighbour.x) / 2, z: (owner.z + neighbour.z) / 2 };
          const across =
            ((prop.worldX - middle.x) * (neighbour.x - owner.x) + (prop.worldZ - middle.z) * (neighbour.z - owner.z)) /
            spacing;
          const along = Math.hypot(prop.worldX - middle.x, prop.worldZ - middle.z);
          return { across: Math.abs(across), along, halfEdge: spacing / (2 * Math.sqrt(3)) };
        });
        const edge = edges.toSorted((a, b) => a.across - b.across)[0];
        expect(edge.across).toBeLessThan(1e-6);
        const reach = getTerrainPropFootprintRadius(prop.archetype) * prop.scale;
        expect(edge.along - reach).toBeGreaterThanOrEqual(TERRAIN_ARMY_ROUTE_HALF_WIDTH - 1e-9);
        expect(edge.along + reach).toBeLessThanOrEqual(edge.halfEdge + 1e-9);
      }
    }
    expect(arches).toBeGreaterThan(0);
  });

  it.each([1, 2] as const)("keeps every prop of layer %i out of an occupied hex", (layer) => {
    const neighbourSpacing = Math.hypot(
      terrainHexToWorld(1, 0).x - terrainHexToWorld(0, 0).x,
      terrainHexToWorld(1, 0).z - terrainHexToWorld(0, 0).z,
    );
    for (const seed of [11, 23, 37]) {
      const cells = block(12, BiomeType.Grassland).map((entry) => ({
        ...entry,
        surfacePresentation: layer,
        occupied: (entry.col === 0 || entry.col === 1) && entry.row === 0,
      }));
      const page = seededRequest(cells, `layer-clearance-${layer}-${seed}`, seed);
      const occupied = cells.filter(({ occupied }) => occupied).map(({ col, row }) => terrainHexToWorld(col, row));
      const props = prepareTerrainPropInstances(page, new TerrainField(page));
      expect(props.length).toBeGreaterThan(0);
      for (const prop of props) {
        for (const centre of occupied) {
          const distance = Math.hypot(prop.worldX - centre.x, prop.worldZ - centre.z);
          const reach = getTerrainPropSpacingRadius(prop.archetype) * prop.scale;
          expect(distance - reach).toBeGreaterThanOrEqual(neighbourSpacing / 2 - 1e-9);
        }
      }
    }
  });

  it("holds a taiga hex at least as thick with conifers as the authored kit did", () => {
    let conifers = 0;
    for (const seed of [11, 23, 37]) {
      const page = seededRequest(block(12, BiomeType.Taiga), `taiga-${seed}`, seed);
      conifers += prepareTerrainPropInstances(page, new TerrainField(page)).filter(
        ({ archetype }) => archetype === "conifer",
      ).length;
    }
    expect(conifers / (144 * 3)).toBeGreaterThanOrEqual(0.572);
  });

  it("grows larger mature crowns and biases regenerating gaps toward pioneer trees", () => {
    // Standing/travel clearance reduces the eligible area; sample enough cells to compare ecological populations.
    const cells = Array.from({ length: 2500 }, (_, index) =>
      cell(index % 50, Math.floor(index / 50), BiomeType.TemperateDeciduousForest),
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
    const snowyCells = Array.from({ length: 900 }, (_, index) =>
      cell(index % 30, Math.floor(index / 30), BiomeType.Snow),
    );
    const rainforestCells = Array.from({ length: 900 }, (_, index) =>
      cell(index % 30, Math.floor(index / 30), BiomeType.TropicalRainForest),
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

  it("biases settlement regrowth edges toward pioneer cover and deadwood", () => {
    const occupiedSites = new Set(
      Array.from({ length: 36 }, (_, index) => `${6 + (index % 6) * 7}:${6 + Math.floor(index / 6) * 7}`),
    );
    const cells = Array.from({ length: 50 * 50 }, (_, index) => {
      const col = index % 50;
      const row = Math.floor(index / 50);
      return cell(col, row, BiomeType.TemperateDeciduousForest, occupiedSites.has(`${col}:${row}`));
    });
    const page = request(cells, "settlement-regrowth");
    const field = new TerrainField(page);
    const contextual = prepareTerrainPropInstances(page, field).map((instance) => ({
      ...instance,
      context: field.samplePropDensityContext(instance.worldX, instance.worldZ, {
        col: instance.ownerCol,
        row: instance.ownerRow,
      }),
    }));
    const regrowth = contextual.filter(({ context }) => context.settlementEdgeStrength > 0.35);
    const undisturbed = contextual.filter(({ context }) => context.settlementEdgeStrength === 0);

    expect(regrowth.length).toBeGreaterThan(2);
    expect(
      average(regrowth.map(({ archetype }) => getTerrainPropDisturbanceAffinity(surfaceProp(archetype)))),
    ).toBeGreaterThan(
      average(undisturbed.map(({ archetype }) => getTerrainPropDisturbanceAffinity(surfaceProp(archetype)))) + 0.08,
    );
    expect(regrowth.some(({ archetype }) => archetype === "shrub" || archetype === "mushroom")).toBe(true);
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

function block(size: number, biome: BiomeType): TerrainCellInput[] {
  return Array.from({ length: size * size }, (_, index) =>
    cell((index % size) - size / 2, Math.floor(index / size) - size / 2, biome),
  );
}
function seededRequest(cells: TerrainCellInput[], pageKey: string, seed: number): TerrainPageRequest {
  return {
    ...request(cells, pageKey),
    climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: seed, moisture_seed: seed * 3 },
  };
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
      disturbanceStrength: overrides.disturbanceStrength ?? 0,
      edgeStrength: overrides.edgeStrength ?? 0.2,
      gapStrength: overrides.gapStrength ?? 0.2,
      maturity: overrides.maturity ?? 0.45,
      roadEdgeStrength: overrides.roadEdgeStrength ?? 0,
      successionStrength: overrides.successionStrength ?? 0.3,
      understoryCover: overrides.understoryCover ?? 0.5,
      settlementEdgeStrength: overrides.settlementEdgeStrength ?? 0,
      waterEdgeStrength: overrides.waterEdgeStrength ?? 0,
    },
    normalY: overrides.normalY ?? 1,
  };
}

function surfaceProp(archetype: TerrainPropArchetypeId) {
  const surface = SURFACE_PROP_IDS.find((id) => id === archetype);
  if (!surface) throw new Error(`${archetype} is not a surface prop`);
  return surface;
}

function isLayerProp(archetype: TerrainPropArchetypeId) {
  return LAYER_PROP_IDS.some((id) => id === archetype);
}

function layerProp(archetype: TerrainPropArchetypeId) {
  const layer = LAYER_PROP_IDS.find((id) => id === archetype);
  if (!layer) throw new Error(`${archetype} is not a layer prop`);
  return layer;
}

function linear(hex: string) {
  return [1, 3, 5].map((start) => (parseInt(hex.slice(start, start + 2), 16) / 255) ** 2.2);
}
