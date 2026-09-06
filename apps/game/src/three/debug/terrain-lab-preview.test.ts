import { ChestModelPath, SHARED_BUILDING_MODEL_PATHS } from "@/three/constants/scene-constants";
import { describe, expect, it } from "vitest";
import { TerrainField } from "@/three/terrain/terrain-field";
import { createTerrainVerificationRequest } from "@/three/terrain/verification/terrain-verification-fixtures";
import { BiomeType } from "@bibliothecadao/types";
import { ModelType } from "@/three/types/army";
import { buildTerrainLabRequest, DEFAULT_TERRAIN_LAB_PREVIEW } from "./terrain-lab-preview";

describe("terrain lab previews", () => {
  it.each(["fixture", "clear", "frontier", "covered"] as const)(
    "builds a consistent %s exploration state without mutating the fixture",
    (fog) => {
      const source = createTerrainVerificationRequest("fog-coast");
      const original = structuredClone(source);
      const request = buildTerrainLabRequest(source, { ...DEFAULT_TERRAIN_LAB_PREVIEW, fog }, { col: 8, row: 5 });
      expect(() => new TerrainField(request)).not.toThrow();
      expect(source).toEqual(original);
      if (fog === "covered") expect(request.cells.every((cell) => !cell.explored && cell.biome === null)).toBe(true);
      if (fog === "clear")
        expect(request.cells.every((cell) => cell.explored && cell.biome === cell.previewBiome)).toBe(true);
      if (fog === "frontier") expect(request.cells.every((cell) => cell.explored === cell.col <= 8)).toBe(true);
      if (fog === "fixture") expect(request.cells).toEqual(source.cells);
    },
  );

  it.each(Object.values(BiomeType).filter((biome) => biome !== BiomeType.None))(
    "previews %s under the same exploration boundary",
    (biome) => {
      const source = createTerrainVerificationRequest("tropical-coast");
      const request = buildTerrainLabRequest(
        source,
        { ...DEFAULT_TERRAIN_LAB_PREVIEW, biome, fog: "frontier" },
        { col: 5, row: 5 },
      );
      expect(() => new TerrainField(request)).not.toThrow();
      expect(request.cells.every((cell) => cell.previewBiome === biome)).toBe(true);
      expect(request.cells.every((cell) => cell.biome === (cell.explored ? biome : null))).toBe(true);
    },
  );

  it("adds and removes building ground while chests preserve the original surface", () => {
    const source = createTerrainVerificationRequest("tropical-coast");
    const selected = source.cells.find((cell) => !cell.occupied)!;
    const building = { col: selected.col, row: selected.row, path: SHARED_BUILDING_MODEL_PATHS[0], yaw: 0 };
    const placed = buildTerrainLabRequest(source, DEFAULT_TERRAIN_LAB_PREVIEW, selected, [building]);
    expect(placed.cells.find((cell) => cell.col === selected.col && cell.row === selected.row)?.occupied).toBe(true);
    expect(placed.settlementAnchors).toHaveLength(source.settlementAnchors.length + 1);
    expect(buildTerrainLabRequest(source, DEFAULT_TERRAIN_LAB_PREVIEW, selected, [])).toEqual(source);
    expect(
      buildTerrainLabRequest(source, DEFAULT_TERRAIN_LAB_PREVIEW, selected, [{ ...building, path: ChestModelPath }]),
    ).toEqual(source);
  });

  it("does not turn an army tile into a building pad", () => {
    const source = createTerrainVerificationRequest("tropical-coast");
    const selected = source.cells.find((cell) => !cell.occupied)!;
    const occupied = buildTerrainLabRequest(
      source,
      { ...DEFAULT_TERRAIN_LAB_PREVIEW, army: ModelType.Knight1 },
      selected,
    );
    expect(occupied.cells).toEqual(source.cells);
    expect(buildTerrainLabRequest(source, DEFAULT_TERRAIN_LAB_PREVIEW, selected).cells).toEqual(source.cells);
  });
});
