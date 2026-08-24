import { describe, expect, it } from "vitest";

import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import {
  applyTerrainFogReveals,
  buildTerrainFogMask,
  TERRAIN_FOG_MASK_TEXELS_PER_HEX_WIDTH,
  type TerrainFogMask,
} from "./terrain-fog-mask";
import type { TerrainShroudInstance } from "./terrain-types";

describe("terrain fog mask", () => {
  it("builds a deterministic continuous mask without gaps between unexplored cells", () => {
    const instances = [fogCell(0, 0, false), fogCell(1.732, 0, false)];
    const first = buildTerrainFogMask(instances)!;
    const second = buildTerrainFogMask(instances)!;

    expect(first).toEqual(second);
    expect(sampleMask(first, 0.866, 0)).toBeGreaterThan(230);
    expect(Math.max(...first.data)).toBe(255);
  });

  it("fades across only a frontier cell toward fully opaque deep fog", () => {
    const frontier = fogCell(0, 0, true, [-1, 0]);
    const deep = fogCell(1.732, 0, false);
    const mask = buildTerrainFogMask([frontier, deep])!;
    const towardExplored = sampleMask(mask, -0.62, 0);
    const towardDeepFog = sampleMask(mask, 0.62, 0);

    expect(towardExplored).toBeGreaterThan(0);
    expect(towardExplored).toBeLessThan(towardDeepFog);
    expect(towardDeepFog).toBeGreaterThan(180);
    expect(sampleMask(mask, deep.worldX, deep.worldZ)).toBe(255);
  });

  it("overscans deep fog beyond concealed terrain so its perimeter cannot leak through", () => {
    const mask = buildTerrainFogMask([fogCell(0, 0, false)])!;

    expect(sampleMask(mask, 1.18, 0)).toBe(255);
  });

  it("clears an organic center-out reveal without mutating the base mask", () => {
    const instance = fogCell(0, 0, true, [-1, 0]);
    const mask = buildTerrainFogMask([instance])!;
    const baseCenter = sampleMask(mask, 0, 0);
    const mid = applyTerrainFogReveals(mask, [{ instance, progress: 0.5 }]);
    const complete = applyTerrainFogReveals(mask, [{ instance, progress: 1 }]);

    expect(sampleData(mid, mask, 0, 0)).toBeLessThan(baseCenter);
    expect(sampleData(complete, mask, 0, 0)).toBe(0);
    expect(sampleMask(mask, 0, 0)).toBe(baseCenter);
  });

  it("clamps adaptive dimensions to the bounded texture contract", () => {
    const minimum = buildTerrainFogMask([fogCell(0, 0, false)])!;
    const maximum = buildTerrainFogMask([fogCell(-1_000, 0, false), fogCell(1_000, 0, false)])!;

    expect([minimum.width, minimum.height]).toEqual([32, 32]);
    expect([maximum.width, maximum.height]).toEqual([1_024, 32]);
  });

  it("keeps window-scale fog on unexplored hexes at production texel density", () => {
    const cells = createWindowScaleCells();
    const unexploredByKey = new Map(cells.filter(({ explored }) => !explored).map((cell) => [cellKey(cell), cell]));
    const instances = Array.from(unexploredByKey.values(), toWindowFogCell);
    const mask = buildTerrainFogMask(instances)!;
    const horizontalTexelDensity = ((mask.width - 1) * Math.sqrt(3)) / (mask.bounds.maxX - mask.bounds.minX);

    expect(mask.width).not.toBe(mask.height);
    expect(horizontalTexelDensity).toBeGreaterThanOrEqual(TERRAIN_FOG_MASK_TEXELS_PER_HEX_WIDTH);

    const exploredCoverage: number[] = [];
    const deepCoverage: number[] = [];
    const frontierCoverage: number[] = [];
    for (const cell of cells) {
      const center = terrainHexToWorld(cell.col, cell.row);
      const coverage = sampleLinearMask(mask, center.x, center.z);
      if (cell.explored) {
        exploredCoverage.push(coverage);
        continue;
      }
      if (!cell.frontier) {
        deepCoverage.push(coverage);
        continue;
      }
      frontierCoverage.push(coverage);
      const deepNeighbor = terrainNeighborCoordinates(cell.col, cell.row)
        .map((coordinate) => unexploredByKey.get(cellKey(coordinate)))
        .find((neighbor) => neighbor && !neighbor.frontier);
      if (deepNeighbor) {
        const deepCenter = terrainHexToWorld(deepNeighbor.col, deepNeighbor.row);
        expect(coverage).toBeLessThanOrEqual(sampleLinearMask(mask, deepCenter.x, deepCenter.z));
      }
    }
    expect(Math.max(...exploredCoverage)).toBe(0);
    expect(Math.min(...deepCoverage)).toBeGreaterThanOrEqual(0.9 * 255);
    expect(Math.min(...frontierCoverage)).toBeGreaterThan(0);
  });
});

interface WindowFogCell {
  col: number;
  explored: boolean;
  frontier: boolean;
  row: number;
}

function createWindowScaleCells(): WindowFogCell[] {
  const cells = Array.from({ length: 96 * 96 }, (_, index) => {
    const col = -48 + (index % 96);
    const row = -48 + Math.floor(index / 96);
    return { col, explored: Math.abs(col) <= 7 && Math.abs(row) <= 7, frontier: false, row };
  });
  const exploredKeys = new Set(cells.filter(({ explored }) => explored).map(cellKey));
  return cells.map((cell) => ({
    ...cell,
    frontier:
      !cell.explored &&
      terrainNeighborCoordinates(cell.col, cell.row).some((coordinate) => exploredKeys.has(cellKey(coordinate))),
  }));
}

function toWindowFogCell(cell: WindowFogCell): TerrainShroudInstance {
  const center = terrainHexToWorld(cell.col, cell.row);
  const directionLength = Math.hypot(center.x, center.z) || 1;
  return {
    col: cell.col,
    frontier: cell.frontier,
    frontierDirection: cell.frontier ? [-center.x / directionLength, -center.z / directionLength] : [0, 0],
    pageKey: "window-fixture",
    row: cell.row,
    seed: 0.37,
    tint: [0.1, 0.12, 0.14],
    worldX: center.x,
    worldY: 0.1,
    worldZ: center.z,
  };
}

function cellKey(cell: { col: number; row: number }): string {
  return `${cell.col}:${cell.row}`;
}

function fogCell(
  worldX: number,
  worldZ: number,
  frontier: boolean,
  frontierDirection: readonly [number, number] = [0, 0],
): TerrainShroudInstance {
  return {
    col: Math.round(worldX),
    frontier,
    frontierDirection,
    pageKey: "fixture",
    row: Math.round(worldZ),
    seed: 0.37,
    tint: [0.1, 0.12, 0.14],
    worldX,
    worldY: 0.1,
    worldZ,
  };
}

function sampleMask(mask: TerrainFogMask, worldX: number, worldZ: number): number {
  return sampleData(mask.data, mask, worldX, worldZ);
}

function sampleData(data: Uint8Array, mask: TerrainFogMask, worldX: number, worldZ: number): number {
  const x = Math.round(((worldX - mask.bounds.minX) / (mask.bounds.maxX - mask.bounds.minX)) * (mask.width - 1));
  const z = Math.round(((worldZ - mask.bounds.minZ) / (mask.bounds.maxZ - mask.bounds.minZ)) * (mask.height - 1));
  return data[Math.min(mask.height - 1, Math.max(0, z)) * mask.width + Math.min(mask.width - 1, Math.max(0, x))];
}

function sampleLinearMask(mask: TerrainFogMask, worldX: number, worldZ: number): number {
  if (
    worldX < mask.bounds.minX ||
    worldX > mask.bounds.maxX ||
    worldZ < mask.bounds.minZ ||
    worldZ > mask.bounds.maxZ
  ) {
    return 0;
  }
  const pixelX = ((worldX - mask.bounds.minX) / (mask.bounds.maxX - mask.bounds.minX)) * (mask.width - 1);
  const pixelZ = ((worldZ - mask.bounds.minZ) / (mask.bounds.maxZ - mask.bounds.minZ)) * (mask.height - 1);
  const minX = Math.floor(pixelX);
  const minZ = Math.floor(pixelZ);
  const maxX = Math.min(mask.width - 1, minX + 1);
  const maxZ = Math.min(mask.height - 1, minZ + 1);
  const blendX = pixelX - minX;
  const blendZ = pixelZ - minZ;
  const top = lerp(mask.data[minZ * mask.width + minX], mask.data[minZ * mask.width + maxX], blendX);
  const bottom = lerp(mask.data[maxZ * mask.width + minX], mask.data[maxZ * mask.width + maxX], blendX);
  return lerp(top, bottom, blendZ);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
