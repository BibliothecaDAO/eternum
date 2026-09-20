import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { BASALT_SUPPORT_HEIGHT } from "./terrain-basalt";
import { terrainHexToWorld } from "./terrain-coordinates";
import { buildEtherealBorderCell } from "./terrain-ethereal-borders";
import { createEtherealTerrainMaterial } from "./terrain-ethereal-material";
import { TerrainField } from "./terrain-field";
import { prepareTerrainPage } from "./terrain-page-builder";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";

const cell = (col: number, overrides: Partial<TerrainCellInput> = {}): TerrainCellInput => ({
  col,
  row: 0,
  biome: BiomeType.Ocean,
  previewBiome: BiomeType.Ocean,
  occupied: false,
  explored: true,
  ...overrides,
});
const request = (
  cells: TerrainCellInput[],
  surfacePresentation: "world" | "ethereal" = "ethereal",
): TerrainPageRequest => ({
  cells,
  surfacePresentation,
  halo: [],
  climate: NEUTRAL_BIOME_CLIMATE,
  mapCenter: 0,
  pageKey: "ethereal-test",
  roadSegments: [],
  settlementAnchors: [],
  subdivisions: 2,
});

describe("ethereal terrain integration", () => {
  it("keeps a full 24×24 page compact instead of expanding hundreds of slab meshes", () => {
    const cells = Array.from({ length: 24 * 24 }, (_, index) =>
      cell(index % 24, { row: Math.floor(index / 24), occupied: index % 17 === 0 }),
    );
    const page = prepareTerrainPage(request(cells));
    expect(page.basaltInstances).toHaveLength(24 * 24 * 2);
    expect(page.basaltInstances!.byteLength).toBe(24 * 24 * 8);
    expect(page.diagnostics.geometryBytes).toBeLessThan(2 * 1024 * 1024);
    expect(page.diagnostics.triangles).toBeLessThan(20_000);
    expect(page.diagnostics.vertices).toBeLessThan(40_000);
    const reordered = prepareTerrainPage(request(cells.toReversed()));
    expect(reordered.fingerprint).toBe(page.fingerprint);
    expect(reordered.basaltInstances).toEqual(page.basaltInstances);
  });

  it("replaces water and ecology without rewriting gameplay biomes", () => {
    const source = request([cell(0, { occupied: true })]);
    const page = prepareTerrainPage(source);
    expect(page.buffers.positions).toHaveLength(0);
    expect(page.waterBuffers).toBeNull();
    expect(page.propInstances).toHaveLength(0);
    expect(page.basaltInstances!.length).toBeGreaterThan(0);
    expect(page.borderBuffers!.indices).toHaveLength(36);
    expect(new TerrainField(source).sampleSurface(0, 0)).toEqual({
      biome: BiomeType.Ocean,
      height: BASALT_SUPPORT_HEIGHT,
      normal: [0, 1, 0],
    });
    expect(source.cells[0].biome).toBe(BiomeType.Ocean);
    const world = prepareTerrainPage({ ...source, surfacePresentation: "world" });
    expect(world.fingerprint).not.toBe(page.fingerprint);
    expect(world.basaltInstances).toBeNull();
  });

  it("blends the surface spire visually into its neighbor while retaining gameplay biomes", () => {
    const source = request([cell(0, { occupied: true, surfacePresentation: "ethereal" }), cell(1)], "world");
    const page = prepareTerrainPage(source);
    expect(page.basaltInstances).toBeNull();
    expect(page.borderBuffers).toBeNull();
    const weights = page.buffers.basaltWeights!;
    expect(weights.some((weight) => weight > 0 && weight < 1)).toBe(true);
    const positions = page.buffers.positions;
    expect(weights.some((weight, i) => weight > 0 && positions[i * 3] > Math.sqrt(3) / 2 + 0.05)).toBe(true);
    expect(weights.some((weight, i) => weight === 0 && positions[i * 3] > 1.5)).toBe(true);
    expect(page.waterBuffers!.indices.length).toBeGreaterThan(0);
    const neighbor = terrainHexToWorld(1, 0);
    expect(new TerrainField(source).sampleSurface(neighbor.x, neighbor.z).height).not.toBe(BASALT_SUPPORT_HEIGHT);
    expect(page.request.cells.map((c) => c.biome)).toEqual([BiomeType.Ocean, BiomeType.Ocean]);
  });

  it("does not build hidden basalt, borders, water or props from unknown biome/occupancy", () => {
    const hidden = (previewBiome: BiomeType, occupied: boolean) =>
      prepareTerrainPage(request([cell(0, { explored: false, biome: null, previewBiome, occupied })]));
    for (const page of [hidden(BiomeType.Ocean, false), hidden(BiomeType.Grassland, true)]) {
      expect(page.buffers.positions).toHaveLength(0);
      expect(page.basaltInstances).toBeNull();
      expect(page.borderBuffers).toBeNull();
      expect(page.waterBuffers).toBeNull();
      expect(page.propInstances).toHaveLength(0);
      expect(page.shroudInstances).toHaveLength(1);
    }
    expect(hidden(BiomeType.Ocean, false).shroudInstances).toEqual(hidden(BiomeType.Grassland, true).shroudInstances);
  });

  it("keeps the rock non-emissive and adds only six inward gameplay-border strips", () => {
    const material = createEtherealTerrainMaterial();
    expect(material.emissive.getHex()).toBe(0);
    expect(material.emissiveNode).toBeNull();
    material.dispose();
    const borders = buildEtherealBorderCell(0, 0);
    expect(borders.positions).toHaveLength(24 * 3);
    expect(borders.indices).toHaveLength(12 * 3);
    for (let i = 0; i < borders.positions.length; i += 3) {
      const x = Math.abs(borders.positions[i]),
        z = Math.abs(borders.positions[i + 2]);
      expect(Math.max(x, x * 0.5 + (z * Math.sqrt(3)) / 2)).toBeLessThanOrEqual(Math.sqrt(3) / 2 + 1e-6);
    }
  });

  it("gives both halves of a shared gameplay edge identical color and flow coordinates", () => {
    const left = buildEtherealBorderCell(-1, 0),
      right = buildEtherealBorderCell(0, 0);
    let matches = 0;
    for (let a = 0; a < 24; a += 4)
      for (let b = 0; b < 24; b += 4) {
        const samePoint = (l: number, r: number) =>
          Math.abs(left.positions[l * 3] - right.positions[r * 3]) < 2e-6 &&
          Math.abs(left.positions[l * 3 + 2] - right.positions[r * 3 + 2]) < 2e-6;
        if (!samePoint(a, b + 1) || !samePoint(a + 1, b)) continue;
        expect(left.colors.slice(a * 3, a * 3 + 3)).toEqual(right.colors.slice(b * 3, b * 3 + 3));
        expect(left.uvs[a * 2]).toBe(right.uvs[(b + 1) * 2]);
        matches++;
      }
    expect(matches).toBe(1);
  });
});
