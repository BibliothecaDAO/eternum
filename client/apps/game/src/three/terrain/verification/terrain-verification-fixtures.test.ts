import { describe, expect, it } from "vitest";

import { TERRAIN_BIOME_ORDER } from "../terrain-palette";
import {
  ALL_BIOMES_COLUMNS,
  ALL_BIOMES_FIXTURE_ID,
  ALL_BIOMES_ROWS,
  createAllBiomesTerrainRequest,
  createTerrainVerificationRequest,
  TERRAIN_ANCHOR_COLUMNS,
  TERRAIN_ANCHOR_ROWS,
  TERRAIN_VERIFICATION_SCENE_IDS,
} from "./terrain-verification-fixtures";

describe("game-scale all-biomes fixture", () => {
  it("fills a large deterministic field with substantial regions for every biome", () => {
    const request = createAllBiomesTerrainRequest();
    const biomeCounts = new Map<string, number>();
    request.cells.forEach(({ biome }) => biomeCounts.set(biome!, (biomeCounts.get(biome!) ?? 0) + 1));

    expect(request.pageKey).toBe(ALL_BIOMES_FIXTURE_ID);
    expect(request.cells).toHaveLength(ALL_BIOMES_COLUMNS * ALL_BIOMES_ROWS);
    expect(new Set(request.cells.map(({ biome }) => biome)).size).toBe(TERRAIN_BIOME_ORDER.length);
    expect(Math.min(...biomeCounts.values())).toBeGreaterThanOrEqual(10);
    expect(request.cells.at(-1)).toMatchObject({ col: ALL_BIOMES_COLUMNS - 1, row: ALL_BIOMES_ROWS - 1 });
    expect(createAllBiomesTerrainRequest()).toEqual(request);
  });

  it("creates deterministic multi-biome anchor scenes with a structure pad", () => {
    TERRAIN_VERIFICATION_SCENE_IDS.filter((sceneId) => sceneId !== "all-biomes").forEach((sceneId) => {
      const first = createTerrainVerificationRequest(sceneId);
      const second = createTerrainVerificationRequest(sceneId);

      expect(second).toEqual(first);
      expect(first.cells).toHaveLength(TERRAIN_ANCHOR_COLUMNS * TERRAIN_ANCHOR_ROWS);
      expect(new Set(first.cells.map(({ biome }) => biome)).size).toBeGreaterThanOrEqual(3);
      expect(first.cells.filter(({ occupied }) => occupied)).toHaveLength(1);
    });
  });
});
