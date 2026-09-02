import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, StructureType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FrameBudgetWorkLane, FrameBudgetWorkScheduler } from "../frame-budget-work-queue";
import { ProceduralTerrain } from "./procedural-terrain";
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

  it("reuses unchanged prepared pages and rebuilds only changed occupancy without a scheduler", async () => {
    stubPageWorker();
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

    await expect(terrain.presentAsync(input)).resolves.toMatchObject({
      builtPages: 1,
      commitMs: expect.any(Number),
      pages: 1,
      reusedPages: 0,
    });
    await expect(terrain.presentAsync(input)).resolves.toMatchObject({
      builtPages: 0,
      commitMs: expect.any(Number),
      reusedPages: 1,
    });
    await expect(
      terrain.presentAsync({ ...input, cells: [{ ...input.cells[0], occupied: true }] }),
    ).resolves.toMatchObject({ builtPages: 1, reusedPages: 0 });
    expect(terrain.getVisibleCellCount()).toBe(1);
    const metrics = terrain.getPresentMetrics();
    // 7 + 5 + 7: each changed page is a geometry task and a writes task; the reused page schedules neither.
    expect(metrics.presentTasks).toBe(19);
    expect(metrics.presentTaskMaxMs).toBeGreaterThanOrEqual(
      Math.max(metrics.presentFogMaxMs, metrics.presentPageTaskMaxMs, metrics.presentRequestsMaxMs),
    );
    terrain.dispose();
  });

  it("commits one composite as partition, roads, a request per page, release, geometry and writes per page, and fog", async () => {
    stubPageWorker();
    const scheduler = createRecordingScheduler();
    const terrain = new WorldmapProceduralTerrain();

    await expect(terrain.presentAsync(twoPageInput(), scheduler)).resolves.toMatchObject({
      builtPages: 2,
      pages: 2,
      reusedPages: 0,
    });

    expect(scheduler.lanes).toEqual(new Set(["critical"]));
    expect(scheduler.owners).toEqual([
      "terrain:present:partition",
      "terrain:present:roads",
      "terrain:present:request",
      "terrain:present:request",
      "terrain:present:release",
      "terrain:present:page",
      "terrain:present:page-writes",
      "terrain:present:page",
      "terrain:present:page-writes",
      "terrain:present:fog",
    ]);
    terrain.dispose();
  });

  it("schedules no page task for a page already presented with the same fingerprint", async () => {
    stubPageWorker();
    const scheduler = createRecordingScheduler();
    const terrain = new WorldmapProceduralTerrain();
    const input = distantPagesInput();
    await terrain.presentAsync(input, scheduler);

    scheduler.owners.length = 0;
    await expect(terrain.presentAsync(input, scheduler)).resolves.toMatchObject({ builtPages: 0, reusedPages: 2 });
    expect(scheduler.owners.filter(isPageStep)).toHaveLength(0);

    scheduler.owners.length = 0;
    const changed = { ...input, cells: [input.cells[0], { ...input.cells[1], occupied: true }] };
    await expect(terrain.presentAsync(changed, scheduler)).resolves.toMatchObject({ builtPages: 1, reusedPages: 1 });
    expect(scheduler.owners.filter(isPageStep)).toHaveLength(1);
    terrain.dispose();
  });

  it("stops scheduling and resolves null when a newer presentation supersedes it mid-pipeline", async () => {
    const input = singlePageInput(0);
    const request = buildWorldmapTerrainPageRequests(input)[0];
    let resolvePage: (page: PreparedTerrainPage) => void = () => undefined;
    const pendingPage = new Promise<PreparedTerrainPage>((resolve) => {
      resolvePage = resolve;
    });
    const preparePageAsync = vi.spyOn(ProceduralTerrain.prototype, "preparePageAsync").mockReturnValue(pendingPage);
    vi.spyOn(ProceduralTerrain.prototype, "prepareFogMaskAsync").mockResolvedValue(null);
    const scheduler = createRecordingScheduler();
    const terrain = new WorldmapProceduralTerrain();

    const superseded = terrain.presentAsync(input, scheduler);
    await flushMicrotasks();
    expect(scheduler.owners).toEqual(["terrain:present:partition", "terrain:present:roads", "terrain:present:request"]);
    scheduler.owners.length = 0;

    const latest = terrain.presentAsync(input, scheduler);
    expect(preparePageAsync).toHaveBeenCalledTimes(1);
    resolvePage(prepareTerrainPage(request));

    await expect(superseded).resolves.toBeNull();
    await expect(latest).resolves.toMatchObject({ builtPages: 0, preparedCachePages: 1, reusedPages: 1 });
    expect(scheduler.owners).toEqual([
      "terrain:present:partition",
      "terrain:present:roads",
      "terrain:present:request",
      "terrain:present:release",
      "terrain:present:page",
      "terrain:present:page-writes",
      "terrain:present:fog",
    ]);
    terrain.dispose();
  });

  it("rebuilds the pages whose halo or settlement influence changed", async () => {
    stubPageWorker();
    const terrain = new WorldmapProceduralTerrain();
    const input = twoPageInput();
    await terrain.presentAsync(input);

    const neighbourChanged = { ...input, cells: [worldCell(1, 0, BiomeType.Taiga), input.cells[1]] };
    await expect(terrain.presentAsync(neighbourChanged)).resolves.toMatchObject({ builtPages: 2, reusedPages: 0 });

    const anchor = { col: 2, level: 1, row: 0, structureId: "east", structureType: StructureType.Realm };
    await expect(terrain.presentAsync({ ...neighbourChanged, settlementAnchors: [anchor] })).resolves.toMatchObject({
      builtPages: 2,
      reusedPages: 0,
    });
    await expect(
      terrain.presentAsync({ ...neighbourChanged, settlementAnchors: [{ ...anchor, level: 3 }] }),
    ).resolves.toMatchObject({ builtPages: 2, reusedPages: 0 });
    terrain.dispose();
  });

  it("bounds prepared pages to the current and previous request sets", async () => {
    stubPageWorker();
    const terrain = new WorldmapProceduralTerrain();

    await expect(terrain.presentAsync(singlePageInput(0))).resolves.toMatchObject({ preparedCachePages: 1 });
    await expect(terrain.presentAsync(singlePageInput(10))).resolves.toMatchObject({ preparedCachePages: 2 });
    await expect(terrain.presentAsync(singlePageInput(20))).resolves.toMatchObject({ preparedCachePages: 2 });
    terrain.dispose();
  });
});

/** Builds pages on the calling thread: jsdom has no Worker, and the fog mask never needs one for these windows. */
function stubPageWorker(): void {
  vi.spyOn(ProceduralTerrain.prototype, "preparePageAsync").mockImplementation((request) =>
    Promise.resolve(prepareTerrainPage(request)),
  );
  vi.spyOn(ProceduralTerrain.prototype, "prepareFogMaskAsync").mockResolvedValue(null);
}

function createRecordingScheduler(): FrameBudgetWorkScheduler & { lanes: Set<FrameBudgetWorkLane>; owners: string[] } {
  const lanes = new Set<FrameBudgetWorkLane>();
  const owners: string[] = [];
  return {
    lanes,
    owners,
    schedule(lane, work, owner) {
      lanes.add(lane);
      owners.push(owner ?? "");
      try {
        return Promise.resolve(work());
      } catch (error) {
        return Promise.reject(error);
      }
    },
  };
}

function isPageStep(owner: string): boolean {
  return owner === "terrain:present:page";
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Two pages whose cells neighbour each other, so each page's halo holds the other's cell. */
function twoPageInput() {
  return {
    cells: [worldCell(1, 0, BiomeType.Grassland), worldCell(2, 0, BiomeType.Beach)],
    climate: NEUTRAL_BIOME_CLIMATE,
    mapCenter: 0,
    pageHeight: 2,
    pageOrigin: { col: 0, row: 0 },
    pageWidth: 2,
    subdivisions: 1,
  };
}

/** Two pages too far apart to share a halo, so a change in one leaves the other's request identical. */
function distantPagesInput() {
  return { ...twoPageInput(), cells: [worldCell(0, 0, BiomeType.Grassland), worldCell(10, 0, BiomeType.Beach)] };
}

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

function worldCell(col: number, row: number, biomeKey: string) {
  return { biomeKey, col, occupied: false, row };
}
