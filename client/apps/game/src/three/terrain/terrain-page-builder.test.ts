import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { prepareTerrainPage } from "./terrain-page-builder";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";
import { createAllBiomesTerrainRequest } from "./verification/terrain-verification-fixtures";

describe("prepareTerrainPage", () => {
  it("builds deterministic indexed terrain and frontier buffers", () => {
    const request = createRequest([cell(0, 0, BiomeType.Ocean)]);
    const first = prepareTerrainPage(request);
    const second = prepareTerrainPage(request);

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.buffers.positions).toEqual(second.buffers.positions);
    expect(first.diagnostics.frontierEdges).toBe(6);
    expect(first.diagnostics.triangles).toBe(66);
    expect(first.waterBuffers).toBeNull();
  });

  it("does not create frontier skirts between explored neighbors", () => {
    const first = cell(0, 0, BiomeType.Grassland);
    const second = cell(1, 0, BiomeType.Taiga);
    const page = prepareTerrainPage(createRequest([first, second]));

    expect(page.diagnostics.frontierEdges).toBe(10);
    expect(page.waterBuffers).toBeNull();
  });

  it("is independent of input traversal order and changes identity with occupancy", () => {
    const first = cell(0, 0, BiomeType.Grassland);
    const second = cell(1, 0, BiomeType.Taiga);
    const forward = prepareTerrainPage(createRequest([first, second]));
    const reverse = prepareTerrainPage(createRequest([second, first]));
    const occupied = prepareTerrainPage(createRequest([{ ...first, occupied: true }, second]));

    expect(forward.fingerprint).toBe(reverse.fingerprint);
    expect(occupied.fingerprint).not.toBe(forward.fingerprint);
  });

  it("rejects invalid topology instead of silently changing geometry density", () => {
    expect(() => prepareTerrainPage({ ...createRequest([cell(0, 0, BiomeType.Bare)]), subdivisions: 0 })).toThrow(
      "Terrain subdivisions must be an integer from 1 to 4",
    );
  });

  it("keeps height, normal, and color continuous at every duplicated shared position", () => {
    const page = prepareTerrainPage(createAllBiomesTerrainRequest());
    const attributesByPosition = new Map<string, number[]>();

    for (let vertex = 0; vertex < page.buffers.positions.length / 3; vertex += 1) {
      const position = readAttribute(page.buffers.positions, vertex, 3);
      const key = position.join(":");
      const attributes = [
        position[1],
        ...readAttribute(page.buffers.normals, vertex, 3),
        ...readAttribute(page.buffers.colors, vertex, 3),
        ...readAttribute(page.buffers.uvs, vertex, 2),
        ...readAttribute(page.buffers.groundWeights0, vertex, 4),
        ...readAttribute(page.buffers.groundWeights1, vertex, 4),
        ...readAttribute(page.buffers.shore, vertex, 1),
      ];
      const existing = attributesByPosition.get(key);
      if (existing) {
        attributes.forEach((value, index) => expect(value).toBeCloseTo(existing[index], 5));
      } else {
        attributesByPosition.set(key, attributes);
      }
    }
  });

  it("packs every continuous ground recipe into eight normalized bytes", () => {
    const page = prepareTerrainPage(createAllBiomesTerrainRequest());

    for (let vertex = 0; vertex < page.buffers.positions.length / 3; vertex += 1) {
      const packedWeights = [
        ...readAttribute(page.buffers.groundWeights0, vertex, 4),
        ...readAttribute(page.buffers.groundWeights1, vertex, 4),
      ];
      expect(packedWeights.reduce((total, weight) => total + weight, 0)).toBe(255);
    }
  });

  it("precomputes exact geometry bounds before the page reaches the main thread", () => {
    const { bounds, positions } = prepareTerrainPage(createAllBiomesTerrainRequest()).buffers;
    const [centerX, centerY, centerZ] = bounds.sphereCenter;
    let allVerticesInsideBox = true;
    let maximumDistance = 0;

    for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
      const [x, y, z] = readAttribute(positions, vertex, 3);
      allVerticesInsideBox &&=
        x >= bounds.boxMin[0] &&
        x <= bounds.boxMax[0] &&
        y >= bounds.boxMin[1] &&
        y <= bounds.boxMax[1] &&
        z >= bounds.boxMin[2] &&
        z <= bounds.boxMax[2];
      maximumDistance = Math.max(maximumDistance, Math.hypot(x - centerX, y - centerY, z - centerZ));
    }

    expect(allVerticesInsideBox).toBe(true);
    expect(maximumDistance).toBeLessThanOrEqual(bounds.sphereRadius + 1e-6);
  });
});

function readAttribute(buffer: Float32Array | Uint8Array, vertex: number, itemSize: number): number[] {
  return Array.from(buffer.subarray(vertex * itemSize, vertex * itemSize + itemSize));
}

function cell(col: number, row: number, biome: BiomeType): TerrainCellInput {
  return { biome, col, occupied: false, row };
}

function createRequest(cells: TerrainCellInput[]): TerrainPageRequest {
  return {
    cells,
    climate: NEUTRAL_BIOME_CLIMATE,
    generation: 1,
    halo: [],
    mapCenter: 0,
    pageKey: "builder-fixture",
    subdivisions: 3,
  };
}
