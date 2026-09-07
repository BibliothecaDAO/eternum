import { ChestModelPath, SHARED_BUILDING_MODEL_PATHS } from "@/three/constants/scene-constants";
import { describe, expect, it } from "vitest";
import { TerrainField } from "@/three/terrain/terrain-field";
import { prepareTerrainPage } from "@/three/terrain/terrain-page-builder";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import { TERRAIN_FOG_GROUND_HEIGHT } from "@/three/terrain/terrain-fog-style";
import { createTerrainVerificationRequest } from "@/three/terrain/verification/terrain-verification-fixtures";
import { BiomeType } from "@bibliothecadao/types";
import { ModelType } from "@/three/types/army";
import { buildTerrainLabRequest, DEFAULT_TERRAIN_LAB_PREVIEW } from "./terrain-lab-preview";

describe("terrain lab previews", () => {
  it("keeps underground geometry, occupied pads and sampled model heights on one flat plane", () => {
    const source = createTerrainVerificationRequest("tropical-coast");
    const selected = { col: 5, row: 5 };
    const request = buildTerrainLabRequest(
      source,
      { ...DEFAULT_TERRAIN_LAB_PREVIEW, biome: "ethereal", fog: "frontier" },
      selected,
      [{ ...selected, path: SHARED_BUILDING_MODEL_PATHS[0], yaw: 0 }],
    );
    const prepared = prepareTerrainPage(request);
    const field = new TerrainField(request);
    expect(new Set(prepared.buffers.heights)).toEqual(new Set([TERRAIN_FOG_GROUND_HEIGHT]));
    expect(
      prepared.buffers.positions.every((value, index) => index % 3 !== 1 || value === TERRAIN_FOG_GROUND_HEIGHT),
    ).toBe(true);
    for (const cell of request.cells.filter((cell) => cell.explored)) {
      const center = terrainHexToWorld(cell.col, cell.row);
      for (const offset of [0, 0.4]) {
        expect(field.sampleSurface(center.x + offset, center.z).height).toBe(TERRAIN_FOG_GROUND_HEIGHT);
        expect(field.sampleSurface(center.x + offset, center.z).normal).toEqual([0, 1, 0]);
      }
    }
    const natural = prepareTerrainPage({ ...request, flatSurface: false });
    expect(new Set(natural.buffers.heights).size).toBeGreaterThan(1);
    expect(natural.fingerprint).not.toBe(prepared.fingerprint);
    expect(buildTerrainLabRequest(source, DEFAULT_TERRAIN_LAB_PREVIEW, selected).flatSurface).toBeUndefined();
  });

  it("uses Bare geometry for a dedicated Ethereal preview without changing gameplay biomes", () => {
    const source = createTerrainVerificationRequest("tropical-coast");
    const original = structuredClone(source);
    const request = buildTerrainLabRequest(
      source,
      { ...DEFAULT_TERRAIN_LAB_PREVIEW, biome: "ethereal", fog: "frontier" },
      { col: 5, row: 5 },
    );
    expect(() => new TerrainField(request)).not.toThrow();
    expect(source).toEqual(original);
    expect([...request.cells, ...request.halo].every((cell) => cell.previewBiome === BiomeType.Bare)).toBe(true);
    expect(request.cells.every((cell) => cell.biome === (cell.explored ? BiomeType.Bare : null))).toBe(true);
    expect(request.cells.some((cell) => cell.explored)).toBe(true);
    expect(request.cells.some((cell) => !cell.explored)).toBe(true);
  });

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
