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
    TERRAIN_VERIFICATION_SCENE_IDS.filter((sceneId) => sceneId !== "all-biomes" && !sceneId.startsWith("fog-")).forEach(
      (sceneId) => {
        const first = createTerrainVerificationRequest(sceneId);
        const second = createTerrainVerificationRequest(sceneId);

        expect(second).toEqual(first);
        expect(first.cells).toHaveLength(TERRAIN_ANCHOR_COLUMNS * TERRAIN_ANCHOR_ROWS);
        expect(new Set(first.cells.map(({ biome }) => biome)).size).toBeGreaterThanOrEqual(3);
        const expectedSettlements = sceneId === "owned-roads" ? 4 : sceneId === "settlement-regrowth" ? 3 : 1;
        expect(first.cells.filter(({ occupied }) => occupied)).toHaveLength(expectedSettlements);
        if (sceneId === "owned-roads" || sceneId === "settlement-regrowth") {
          expect(first.roadSegments.length).toBeGreaterThan(0);
        } else expect(first.roadSegments).toEqual([]);
      },
    );
  });

  it("creates deterministic fog scenarios with both explored and unknown coverage", () => {
    TERRAIN_VERIFICATION_SCENE_IDS.filter((sceneId) => sceneId.startsWith("fog-")).forEach((sceneId) => {
      const first = createTerrainVerificationRequest(sceneId);
      const second = createTerrainVerificationRequest(sceneId);

      expect(second).toEqual(first);
      expect(first.cells.some(({ explored }) => explored)).toBe(true);
      expect(first.cells.some(({ explored }) => !explored)).toBe(true);
      expect(
        new Set(first.cells.filter(({ explored }) => explored).map(({ biome }) => biome)).size,
      ).toBeGreaterThanOrEqual(3);
      expect(first.cells.filter(({ explored, biome }) => !explored && biome !== null)).toHaveLength(0);
      expect(first.cells.filter(({ explored, previewBiome }) => !explored && !previewBiome)).toHaveLength(0);
    });
  });

  it("combines three settlement realms with roads and regrowth in one evaluation scene", () => {
    const settlement = createTerrainVerificationRequest("settlement-regrowth");

    expect(settlement.cells.filter(({ occupied }) => occupied)).toHaveLength(3);
    expect(settlement.roadSegments.length).toBeGreaterThan(0);
    expect(new Set(settlement.roadSegments.map(({ routeId }) => routeId))).toHaveLength(2);
  });
});
