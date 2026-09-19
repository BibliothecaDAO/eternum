import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { SurfaceBasaltTransition, visitSurfaceBasaltSlabs } from "./terrain-basalt-transition";
import { terrainHexToWorld } from "./terrain-coordinates";
import { TerrainField } from "./terrain-field";
import { prepareTerrainPage } from "./terrain-page-builder";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";

const cell = (col: number, overrides: Partial<TerrainCellInput> = {}): TerrainCellInput => ({
  col,
  row: 0,
  biome: BiomeType.Grassland,
  previewBiome: BiomeType.Grassland,
  explored: true,
  occupied: false,
  ...overrides,
});
const source = (cells: TerrainCellInput[], halo: TerrainCellInput[] = []): TerrainPageRequest => ({
  cells,
  halo,
  climate: NEUTRAL_BIOME_CLIMATE,
  mapCenter: 0,
  pageKey: "margin",
  roadSegments: [],
  settlementAnchors: [],
  surfacePresentation: "world",
});
const spire = cell(0, { surfacePresentation: "ethereal", occupied: true });

describe("surface basalt margins", () => {
  it("partitions the full tile once and completes boundary slabs with identical weights in the neighbour", () => {
    const transition = new SurfaceBasaltTransition(source([spire, cell(1)]));
    const weights = new Map<string, number>();
    let shared = 0;
    for (const owner of [spire, cell(1)]) {
      let area = 0;
      visitSurfaceBasaltSlabs(owner, (polygon, center) => {
        for (let i = 1; i < polygon.length - 1; i++) {
          const a = polygon[0],
            b = polygon[i],
            c = polygon[i + 1];
          area += Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2;
        }
        const key = `${center.x}:${center.z}`;
        const weight = transition.slabWeight(center.x, center.z, owner);
        if (weights.has(key)) {
          expect(weight).toBe(weights.get(key));
          expect(weight).toBe(1);
          shared++;
        }
        weights.set(key, weight);
      });
      expect(area).toBeCloseTo((3 * Math.sqrt(3)) / 2, 5);
    }
    expect(shared).toBeGreaterThan(0);
  });

  it("matches geometry and material across independently prepared page boundaries", () => {
    const left = prepareTerrainPage(source([spire], [cell(1)]));
    const right = prepareTerrainPage(source([cell(1)], [spire]));
    const boundary = Math.sqrt(3) / 2;
    const samples = (page: typeof left) => {
      const result = new Map<string, number[]>();
      for (let i = 0; i < page.buffers.positions.length; i += 3) {
        if (Math.abs(page.buffers.positions[i] - boundary) > 2e-6 || page.buffers.normals[i + 1] < 0.5) continue;
        result.set(page.buffers.positions[i + 2].toFixed(5), [
          page.buffers.positions[i + 1],
          page.buffers.basaltWeights![i / 3],
        ]);
      }
      return result;
    };
    const a = samples(left),
      b = samples(right);
    expect(a.size).toBeGreaterThan(0);
    expect(b).toEqual(a);
    for (const [height, weight] of a.values()) {
      expect(height).toBeCloseTo(0.12, 6);
      expect(weight).toBe(1);
    }
    const field = new TerrainField(source([spire, cell(1)]));
    expect(field.sampleSurface(0.9, 0).height).toBeCloseTo(0.12, 6);
    const neighbor = terrainHexToWorld(1, 0);
    const ordinary = new TerrainField(source([cell(0), cell(1)]));
    expect(field.sampleSurface(neighbor.x, neighbor.z).height).toBeCloseTo(
      ordinary.sampleSurface(neighbor.x, neighbor.z).height,
      6,
    );
  });

  it("joins the ordinary terrain edge at both meshes' vertices for every quality level", () => {
    const cells: TerrainCellInput[] = [];
    for (let row = -2; row <= 2; row++)
      for (let col = -2; col <= 4; col++)
        cells.push(cell(col, { row, biome: BiomeType.Bare, previewBiome: BiomeType.Bare }));
    cells.find((c) => c.col === 0 && c.row === 0)!.surfacePresentation = "ethereal";
    const boundary = Math.sqrt(3) * 1.5;
    const edge = (page: ReturnType<typeof prepareTerrainPage>) => {
      const vertices = new Map<number, number>();
      for (let i = 0; i < page.buffers.positions.length; i += 3) {
        const [x, y, z] = page.buffers.positions.slice(i, i + 3);
        if (Math.abs(x - boundary) < 2e-6 && Math.abs(z) <= 0.500001 && page.buffers.normals[i + 1] > 0.5)
          vertices.set(z, y);
      }
      return [...vertices].sort((a, b) => a[0] - b[0]);
    };
    const heightAt = (vertices: number[][], z: number) => {
      for (let i = 1; i < vertices.length; i++)
        if (z <= vertices[i][0] + 1e-6) {
          const [az, ay] = vertices[i - 1],
            [bz, by] = vertices[i];
          return ay + ((by - ay) * (z - az)) / (bz - az);
        }
      throw new Error("Missing edge segment");
    };
    for (const subdivisions of [1, 2, 3, 4]) {
      const build = (col: number) =>
        prepareTerrainPage({
          ...source(
            [cells.find((c) => c.col === col && c.row === 0)!],
            cells.filter((c) => c.col !== col || c.row !== 0),
          ),
          subdivisions,
        });
      const a = edge(build(1)),
        b = edge(build(2));
      for (const [z] of [...a, ...b]) expect(heightAt(a, z)).toBeCloseTo(heightAt(b, z), 6);
    }
  });

  it("does not expose a hidden spire or place a mineral margin into unexplored cells", () => {
    const hidden = cell(0, { explored: false, biome: null, surfacePresentation: "ethereal", occupied: true });
    const without = { ...hidden, surfacePresentation: undefined, occupied: false };
    const shown = prepareTerrainPage(source([cell(1)], [hidden]));
    const ordinary = prepareTerrainPage(source([cell(1)], [without]));
    expect(shown.buffers).toEqual(ordinary.buffers);
    expect(shown.propInstances).toEqual(ordinary.propInstances);
    const unknown = prepareTerrainPage(source([cell(1, { explored: false, biome: null })], [spire]));
    expect(unknown.buffers.positions.length).toBe(0);
    expect(unknown.basaltInstances).toBeNull();
    expect(unknown.borderBuffers).toBeNull();
  });

  it("ignores surface fringes on the ethereal layer and never creates surface neon", () => {
    const world = prepareTerrainPage(source([spire, cell(1)]));
    expect(world.borderBuffers).toBeNull();
    expect(world.basaltInstances).toBeNull();
    const underground = prepareTerrainPage({ ...source([spire, cell(1)]), surfacePresentation: "ethereal" });
    expect(underground.basaltInstances).toHaveLength(4);
    expect(underground.borderBuffers!.indices.length).toBe(72);
    expect(underground.buffers.indices.length).toBe(0);
  });
});
