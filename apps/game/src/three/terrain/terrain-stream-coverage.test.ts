import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";
import { TerrainStreamCoverage } from "./terrain-stream-coverage";
import type { TerrainPageRequest } from "./terrain-types";

const request = (pageKey: string, col: number, row = 0): TerrainPageRequest => ({
  pageKey,
  cells: [{ col, row, biome: null, previewBiome: null, explored: false, occupied: false }],
  climate: NEUTRAL_BIOME_CLIMATE,
  halo: [],
  mapCenter: 0,
  roadSegments: [],
  settlementAnchors: [],
});

function coverage(mask: TerrainStreamCoverage, col: number, row = 0): number {
  const { x, y, z } = mask.bounds.value;
  return (mask.texture.image.data as Uint8Array)[(row - y - 0.5) * z + col - x - 0.5];
}

describe("streamed terrain coverage", () => {
  it("starts covered, reveals only committed pages, and leaves unloaded neighbours covered", () => {
    const mask = new TerrainStreamCoverage();
    mask.commit([request("west", -24, -24)]);
    expect(coverage(mask, -24, -24)).toBe(0);
    mask.update(0.2);
    expect(coverage(mask, -24, -24)).toBe(128);
    expect(coverage(mask, -23, -24)).toBe(0);
    mask.update(0.2);
    expect(coverage(mask, -24, -24)).toBe(255);
    const version = mask.texture.version;
    mask.update(1);
    mask.commit([request("west", -24, -24)]);
    expect(mask.texture.version).toBe(version);
    mask.dispose();
  });

  it("preserves a retained page's fade across window changes and covers evicted pages immediately", () => {
    const mask = new TerrainStreamCoverage();
    mask.commit([request("west", 0)]);
    mask.update(0.2);
    mask.commit([request("west", 0), request("east", 2)]);
    expect(coverage(mask, 0)).toBe(128);
    expect(coverage(mask, 2)).toBe(0);
    mask.update(0.2);
    expect(coverage(mask, 0)).toBe(255);
    expect(coverage(mask, 2)).toBe(128);
    mask.commit([request("east", 2)]);
    expect(coverage(mask, 1)).toBe(0);
    mask.commit([request("west", 0), request("east", 2)]);
    expect(coverage(mask, 0)).toBe(0);
    expect(coverage(mask, 2)).toBe(128);
    mask.commit([]);
    expect(Array.from(mask.texture.image.data as Uint8Array)).toEqual([0]);
    mask.dispose();
  });

  it("honours reduced motion without delaying terrain visibility", () => {
    const mask = new TerrainStreamCoverage();
    mask.setReducedMotion(true);
    mask.commit([request("west", 0)]);
    expect(coverage(mask, 0)).toBe(255);
    mask.dispose();
  });
});
