import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, StructureType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProceduralTerrain, type TerrainPresentationDiagnostics } from "./procedural-terrain";
import { prepareTerrainPage } from "./terrain-page-builder";
import type { PreparedTerrainPage } from "./terrain-types";
import { WorldmapProceduralTerrain, buildWorldmapTerrainPageRequests } from "./worldmap-procedural-terrain";

describe("WorldmapProceduralTerrain", () => {
  afterEach(() => vi.restoreAllMocks());

  it("partitions signed coordinates relative to the visual origin with exact one-ring halos", () => {
    const requests = buildWorldmapTerrainPageRequests({
      cells: [worldCell(-1, 0, BiomeType.Grassland), worldCell(0, 0, BiomeType.Taiga), worldCell(1, 0, "Outline")],
      climate: NEUTRAL_BIOME_CLIMATE,
      mapCenter: 0,
      pageHeight: 2,
      pageOrigin: { col: -1, row: 0 },
      pageWidth: 2,
      subdivisions: 1,
    });

    expect(requests.map(({ pageKey }) => pageKey)).toEqual(["0,-1", "0,1"]);
    expect(requests[0].halo.map(({ col }) => col)).toEqual([1]);
    expect(requests[1].halo.map(({ col }) => col)).toEqual([0]);
    expect(requests[1].cells[0].biome).toBeNull();
    expect(requests[1].cells[0].previewBiome).toBeNull();
  });

  it("maps a complete four-by-four visual window to the same sixteen page keys", () => {
    const pageOrigin = { col: -12, row: -12 };
    const pageStarts = [-36, -12, 12, 36];
    const cells = pageStarts.flatMap((startRow) =>
      pageStarts.flatMap((startCol) =>
        Array.from({ length: 24 * 24 }, (_, index) =>
          worldCell(startCol + (index % 24), startRow + Math.floor(index / 24), BiomeType.Grassland),
        ),
      ),
    );
    const requests = buildWorldmapTerrainPageRequests({
      cells,
      mapCenter: 0,
      pageHeight: 24,
      pageOrigin,
      pageWidth: 24,
    });
    const visualPageKeys = pageStarts.flatMap((row) => pageStarts.map((col) => `${row},${col}`));

    expect(requests).toHaveLength(16);
    expect(new Set(requests.map(({ pageKey }) => pageKey))).toEqual(new Set(visualPageKeys));
  });

  it("propagates the explicit prop density into every prepared page", () => {
    const requests = buildWorldmapTerrainPageRequests({
      cells: [worldCell(0, 0, BiomeType.Grassland), worldCell(2, 0, BiomeType.Taiga)],
      mapCenter: 0,
      pageHeight: 1,
      pageOrigin: { col: 0, row: 0 },
      pageWidth: 1,
      propDensityMultiplier: 1.5,
    });

    expect(requests.map(({ propDensityMultiplier }) => propDensityMultiplier)).toEqual([1.5, 1.5]);
  });

  it("partitions a same-owner road across pages without changing its global segments", () => {
    const cells = Array.from({ length: 6 }, (_, col) => worldCell(col, 0, BiomeType.Grassland));
    const requests = buildWorldmapTerrainPageRequests({
      cells,
      mapCenter: 0,
      pageHeight: 1,
      pageOrigin: { col: 0, row: 0 },
      pageWidth: 3,
      roadAnchors: [
        { col: 0, owner: "1", row: 0, structureId: "west" },
        { col: 5, owner: "1", row: 0, structureId: "east" },
      ],
    });
    const segments = requests.flatMap(({ roadSegments }) => roadSegments);
    const segmentKeys = new Set(segments.map(({ start, end }) => `${start.join(",")}:${end.join(",")}`));

    expect(requests).toHaveLength(2);
    expect(requests.every(({ roadSegments }) => roadSegments.length > 0)).toBe(true);
    expect(segmentKeys).toHaveLength(5);
  });

  it("partitions authoritative structure level and category with the pages they influence", () => {
    const cells = Array.from({ length: 6 }, (_, col) => ({
      ...worldCell(col, 0, BiomeType.Grassland),
      occupied: col === 0 || col === 5,
    }));
    const requests = buildWorldmapTerrainPageRequests({
      cells,
      mapCenter: 0,
      pageHeight: 1,
      pageOrigin: { col: 0, row: 0 },
      pageWidth: 3,
      settlementAnchors: [
        { col: 0, level: 1, row: 0, structureId: "west", structureType: StructureType.Village },
        { col: 5, level: 4, row: 0, structureId: "east", structureType: StructureType.Realm },
      ],
    });

    expect(requests.map(({ settlementAnchors }) => settlementAnchors.map(({ structureId }) => structureId))).toEqual([
      ["west"],
      ["east"],
    ]);
  });

  it("reuses unchanged prepared pages and rebuilds only changed occupancy", () => {
    const terrain = new WorldmapProceduralTerrain();
    const input = {
      cells: [worldCell(0, 0, BiomeType.Beach)],
      climate: NEUTRAL_BIOME_CLIMATE,
      mapCenter: 0,
      pageHeight: 2,
      pageOrigin: { col: 0, row: 0 },
      pageWidth: 2,
      subdivisions: 1,
    };

    expect(terrain.present(input)).toMatchObject({ builtPages: 1, commitMs: expect.any(Number), reusedPages: 0 });
    expect(terrain.present(input)).toMatchObject({ builtPages: 0, commitMs: expect.any(Number), reusedPages: 1 });
    expect(terrain.present({ ...input, cells: [{ ...input.cells[0], occupied: true }] })).toMatchObject({
      builtPages: 1,
      reusedPages: 0,
    });
    terrain.dispose();
  });

  it("shares identical in-flight builds and caches their result before the latest commit", async () => {
    const input = singlePageInput(0);
    const request = buildWorldmapTerrainPageRequests(input)[0];
    let resolvePage: (page: PreparedTerrainPage) => void = () => undefined;
    const pendingPage = new Promise<PreparedTerrainPage>((resolve) => {
      resolvePage = resolve;
    });
    const preparePageAsync = vi.spyOn(ProceduralTerrain.prototype, "preparePageAsync").mockReturnValue(pendingPage);
    vi.spyOn(ProceduralTerrain.prototype, "prepareFogMaskAsync").mockResolvedValue(null);
    vi.spyOn(ProceduralTerrain.prototype, "present").mockReturnValue(emptyPresentationDiagnostics());
    const terrain = new WorldmapProceduralTerrain();

    const superseded = terrain.presentAsync(input);
    const latest = terrain.presentAsync(input);
    expect(preparePageAsync).toHaveBeenCalledTimes(1);

    resolvePage(prepareTerrainPage(request));
    await expect(superseded).resolves.toBeNull();
    await expect(latest).resolves.toMatchObject({ builtPages: 0, preparedCachePages: 1, reusedPages: 1 });
    terrain.dispose();
  });

  it("bounds prepared pages to the current and previous request sets", () => {
    const terrain = new WorldmapProceduralTerrain();

    expect(terrain.present(singlePageInput(0)).preparedCachePages).toBe(1);
    expect(terrain.present(singlePageInput(10)).preparedCachePages).toBe(2);
    expect(terrain.present(singlePageInput(20)).preparedCachePages).toBe(2);
    terrain.dispose();
  });
});

function singlePageInput(col: number) {
  return {
    cells: [worldCell(col, 0, "Outline")],
    climate: NEUTRAL_BIOME_CLIMATE,
    mapCenter: 0,
    pageHeight: 2,
    pageOrigin: { col: 0, row: 0 },
    pageWidth: 2,
    subdivisions: 1,
  };
}

function emptyPresentationDiagnostics(): TerrainPresentationDiagnostics {
  return {
    fogTerrainCells: 0,
    frontierPreviewCells: 0,
    geometryBytes: 0,
    groundCoverInstances: 0,
    pages: 0,
    propInstances: 0,
    propTriangles: 0,
    roadSegments: 0,
    settlementSites: 0,
    shroudInstances: 0,
    shroudTriangles: 0,
    triangles: 0,
    vertices: 0,
  };
}

function worldCell(col: number, row: number, biomeKey: string) {
  return { biomeKey, col, occupied: false, row };
}
