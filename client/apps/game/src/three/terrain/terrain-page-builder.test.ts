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
    expect(first.diagnostics.triangles).toBe(120);
    expect(first.waterBuffers?.indices).toHaveLength(162);
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

  it("changes identity when halo exploration changes frontier shroud presentation", () => {
    const owned = unknownCell(0, 0);
    const hiddenNeighbor = unknownCell(1, 0);
    const exploredNeighbor = cell(1, 0, BiomeType.Grassland);
    const hidden = prepareTerrainPage({ ...createRequest([owned]), halo: [hiddenNeighbor] });
    const frontier = prepareTerrainPage({ ...createRequest([owned]), halo: [exploredNeighbor] });

    expect(hidden.shroudInstances[0].frontier).toBe(false);
    expect(hidden.diagnostics.frontierPreviewCells).toBe(0);
    expect(hidden.buffers.positions).toHaveLength(0);
    expect(frontier.shroudInstances[0].frontier).toBe(true);
    expect(frontier.diagnostics.frontierPreviewCells).toBe(1);
    expect(frontier.buffers.positions.length).toBeGreaterThan(0);
    expect(Array.from(frontier.buffers.explored).every((value) => value === 0)).toBe(true);
    expect(frontier.fingerprint).not.toBe(hidden.fingerprint);
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

  it("warps absolute ground coordinates continuously to break visible material repetition", () => {
    const { positions, uvs } = prepareTerrainPage(createAllBiomesTerrainRequest()).buffers;
    let maximumOffset = 0;

    for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
      const [x, , z] = readAttribute(positions, vertex, 3);
      const [u, v] = readAttribute(uvs, vertex, 2);
      maximumOffset = Math.max(maximumOffset, Math.hypot(u - x, v - z));
    }

    expect(maximumOffset).toBeGreaterThan(0.01);
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
  return { biome, col, explored: true, occupied: false, previewBiome: biome, row };
}

function unknownCell(col: number, row: number, previewBiome = BiomeType.Grassland): TerrainCellInput {
  return { biome: null, col, explored: false, occupied: false, previewBiome, row };
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
