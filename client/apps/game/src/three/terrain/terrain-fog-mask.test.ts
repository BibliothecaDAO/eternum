import { describe, expect, it } from "vitest";

import { applyTerrainFogReveals, buildTerrainFogMask, type TerrainFogMask } from "./terrain-fog-mask";
import type { TerrainShroudInstance } from "./terrain-types";

describe("terrain fog mask", () => {
  it("builds a deterministic continuous mask without gaps between unexplored cells", () => {
    const instances = [fogCell(0, 0, false), fogCell(1.732, 0, false)];
    const first = buildTerrainFogMask(instances, 96)!;
    const second = buildTerrainFogMask(instances, 96)!;

    expect(first).toEqual(second);
    expect(sampleMask(first, 0.866, 0)).toBeGreaterThan(230);
    expect(Math.max(...first.data)).toBe(255);
  });

  it("fades across only a frontier cell toward fully opaque deep fog", () => {
    const frontier = fogCell(0, 0, true, [-1, 0]);
    const deep = fogCell(1.732, 0, false);
    const mask = buildTerrainFogMask([frontier, deep], 128)!;
    const towardExplored = sampleMask(mask, -0.62, 0);
    const towardDeepFog = sampleMask(mask, 0.62, 0);

    expect(towardExplored).toBeGreaterThan(0);
    expect(towardExplored).toBeLessThan(towardDeepFog);
    expect(towardDeepFog).toBeGreaterThan(180);
    expect(sampleMask(mask, deep.worldX, deep.worldZ)).toBe(255);
  });

  it("overscans deep fog beyond concealed terrain so its perimeter cannot leak through", () => {
    const mask = buildTerrainFogMask([fogCell(0, 0, false)], 128)!;

    expect(sampleMask(mask, 1.18, 0)).toBe(255);
  });

  it("clears an organic center-out reveal without mutating the base mask", () => {
    const instance = fogCell(0, 0, true, [-1, 0]);
    const mask = buildTerrainFogMask([instance], 96)!;
    const baseCenter = sampleMask(mask, 0, 0);
    const mid = applyTerrainFogReveals(mask, [{ instance, progress: 0.5 }]);
    const complete = applyTerrainFogReveals(mask, [{ instance, progress: 1 }]);

    expect(sampleData(mid, mask, 0, 0)).toBeLessThan(baseCenter);
    expect(sampleData(complete, mask, 0, 0)).toBe(0);
    expect(sampleMask(mask, 0, 0)).toBe(baseCenter);
  });

  it("rejects mask sizes that would silently violate the bounded texture contract", () => {
    expect(() => buildTerrainFogMask([fogCell(0, 0, false)], 16)).toThrow("must be an integer from 32 to 1024");
  });
});

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
  const x = Math.round(((worldX - mask.bounds.minX) / (mask.bounds.maxX - mask.bounds.minX)) * (mask.resolution - 1));
  const z = Math.round(((worldZ - mask.bounds.minZ) / (mask.bounds.maxZ - mask.bounds.minZ)) * (mask.resolution - 1));
  return data[
    Math.min(mask.resolution - 1, Math.max(0, z)) * mask.resolution + Math.min(mask.resolution - 1, Math.max(0, x))
  ];
}
