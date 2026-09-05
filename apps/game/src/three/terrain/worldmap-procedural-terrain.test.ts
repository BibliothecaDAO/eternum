import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType, StructureType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FrameBudgetWorkLane, FrameBudgetWorkScheduler } from "../frame-budget-work-queue";
import { terrainHexToWorld } from "./terrain-coordinates";
import { ProceduralTerrain } from "./procedural-terrain";
import { prepareTerrainPage } from "./terrain-page-builder";
import type { PreparedTerrainPage } from "./terrain-types";
import {
  WorldmapProceduralTerrain,
  buildWorldmapTerrainPageRequests,
  type TerrainPresentationEvent,
} from "./worldmap-procedural-terrain";

vi.mock("./terrain-prop-asset-cache", async () => {
  const { createTerrainPropCatalogFixture } = await import("./verification/terrain-prop-catalog-fixture");
  return { loadTerrainPropCatalog: () => Promise.resolve({ scene: createTerrainPropCatalogFixture() }) };
});

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
      prepareMs: expect.any(Number),
      reusedPages: 0,
    });
    await expect(terrain.presentAsync(input)).resolves.toMatchObject({
      builtPages: 0,
      commitMs: expect.any(Number),
      prepareMs: 0,
      reusedPages: 1,
    });
    await expect(
      terrain.presentAsync({ ...input, cells: [{ ...input.cells[0], occupied: true }] }),
    ).resolves.toMatchObject({ builtPages: 1, reusedPages: 0 });
    expect(terrain.getVisibleCellCount()).toBe(1);
    const metrics = terrain.getPresentMetrics();
    // 4 + 3 + 4: each coherent changed page is one task; the reused page schedules none.
    expect(metrics.presentTasks).toBe(11);
    expect(metrics.presentTaskMaxMs).toBeGreaterThanOrEqual(
      Math.max(metrics.presentPageTaskMaxMs, metrics.presentRequestsMaxMs),
    );
    terrain.dispose();
  });

  it("commits an authoritative composite as one coherent page group", async () => {
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
      "terrain:present:page",
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
      "terrain:present:page",
    ]);
    terrain.dispose();
  });

  it("does not queue remaining worker pages after a presentation is superseded", async () => {
    const input = distantPagesInput();
    const firstRequest = buildWorldmapTerrainPageRequests(input)[0];
    let resolveFirstPage: (page: PreparedTerrainPage) => void = () => undefined;
    const firstPage = new Promise<PreparedTerrainPage>((resolve) => {
      resolveFirstPage = resolve;
    });
    const preparePageAsync = vi
      .spyOn(ProceduralTerrain.prototype, "preparePageAsync")
      .mockImplementation((request) =>
        request.pageKey === firstRequest.pageKey ? firstPage : Promise.resolve(prepareTerrainPage(request)),
      );
    vi.spyOn(ProceduralTerrain.prototype, "prepareFogMaskAsync").mockResolvedValue(null);
    const terrain = new WorldmapProceduralTerrain();

    const superseded = terrain.presentAsync(input);
    await flushMicrotasks();
    const latest = terrain.presentAsync({ ...singlePageInput(0), cells: [input.cells[0]] });
    resolveFirstPage(prepareTerrainPage(firstRequest));

    await expect(superseded).resolves.toBeNull();
    await expect(latest).resolves.toMatchObject({ builtPages: 0, reusedPages: 1 });
    expect(preparePageAsync.mock.calls.map(([request]) => request.pageKey)).toEqual([firstRequest.pageKey]);
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

  it("reuses a prepared page after more than one intervening camera window", async () => {
    stubPageWorker();
    const terrain = new WorldmapProceduralTerrain();

    await expect(terrain.presentAsync(singlePageInput(0))).resolves.toMatchObject({ preparedCachePages: 1 });
    await expect(terrain.presentAsync(singlePageInput(10))).resolves.toMatchObject({ preparedCachePages: 2 });
    await expect(terrain.presentAsync(singlePageInput(20))).resolves.toMatchObject({ preparedCachePages: 3 });
    await expect(terrain.presentAsync(singlePageInput(0))).resolves.toMatchObject({
      builtPages: 0,
      preparedCachePages: 3,
      reusedPages: 1,
    });
    terrain.dispose();
  });

  it("bounds the prepared-page LRU while retaining recently visited pages", async () => {
    stubPageWorker();
    const terrain = new WorldmapProceduralTerrain();

    for (let page = 0; page < 65; page += 1) {
      await terrain.presentAsync(singlePageInput(page * 2));
    }

    await expect(terrain.presentAsync(singlePageInput(128))).resolves.toMatchObject({
      builtPages: 0,
      preparedCachePages: 64,
      reusedPages: 1,
    });
    await expect(terrain.presentAsync(singlePageInput(0))).resolves.toMatchObject({
      builtPages: 1,
      preparedCachePages: 64,
      reusedPages: 0,
    });
    terrain.dispose();
  });

  it("builds the newly focused page before the rest of the visible window", async () => {
    const preparedPageKeys: string[] = [];
    vi.spyOn(ProceduralTerrain.prototype, "preparePageAsync").mockImplementation((request) => {
      preparedPageKeys.push(request.pageKey);
      return Promise.resolve(prepareTerrainPage(request));
    });
    vi.spyOn(ProceduralTerrain.prototype, "prepareFogMaskAsync").mockResolvedValue(null);
    const terrain = new WorldmapProceduralTerrain();

    await terrain.presentAsync({ ...distantPagesInput(), priorityPageKeys: ["0,10", "0,0", "0,10"] });

    expect(preparedPageKeys).toEqual(["0,10", "0,0"]);
    terrain.dispose();
  });

  it("commits a complete page before a matching presentation supersedes its queued work", async () => {
    vi.spyOn(ProceduralTerrain.prototype, "preparePageAsync").mockImplementation((request) =>
      Promise.resolve(prepareTerrainPage(request)),
    );
    vi.spyOn(ProceduralTerrain.prototype, "prepareFogMaskAsync").mockResolvedValue(null);
    const scheduler = createControlledScheduler();
    const terrain = new WorldmapProceduralTerrain();
    const input = singlePageInput(0);

    const first = terrain.presentAsync(input, scheduler);
    await scheduler.runUntil("terrain:present:page");

    expect(terrain.getShroudStats().instances).toBe(1);

    const second = terrain.presentAsync(input, scheduler);
    await scheduler.runAll();

    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toMatchObject({ pages: 1, reusedPages: 1 });
    expect(terrain.getShroudStats().instances).toBe(1);
    terrain.dispose();
  });

  it("presents a ready focus page while an unrelated cold page is still preparing", async () => {
    let resolveCold: (page: PreparedTerrainPage) => void = () => undefined;
    let coldRequest: Parameters<typeof prepareTerrainPage>[0] | undefined;
    const coldPage = new Promise<PreparedTerrainPage>((resolve) => {
      resolveCold = resolve;
    });
    vi.spyOn(ProceduralTerrain.prototype, "preparePageAsync").mockImplementation((request) => {
      if (request.pageKey === "0,10") {
        coldRequest = request;
        return coldPage;
      }
      return Promise.resolve(prepareTerrainPage(request));
    });
    vi.spyOn(ProceduralTerrain.prototype, "prepareFogMaskAsync").mockResolvedValue(null);
    const terrain = new WorldmapProceduralTerrain();

    const presentation = terrain.presentAsync({
      ...distantPagesInput(),
      commitMode: "ambient",
      priorityPageKeys: ["0,0"],
    });
    await flushMicrotasks();

    const focus = terrainHexToWorld(0, 0);
    expect(coldRequest).toBeDefined();
    expect(terrain.sampleSurface(focus.x, focus.z).biome).toBe(BiomeType.Grassland);
    expect(terrain.getVisibleCellCount()).toBe(1);

    resolveCold(prepareTerrainPage(coldRequest!));
    await expect(presentation).resolves.toMatchObject({ pages: 2 });
    terrain.dispose();
  });

  it("finishes each ambient page's fog before requesting the next page from the shared worker", async () => {
    const workerOrder: string[] = [];
    vi.spyOn(ProceduralTerrain.prototype, "preparePageAsync").mockImplementation((request) => {
      workerOrder.push(`page:${request.pageKey}`);
      return Promise.resolve(prepareTerrainPage(request));
    });
    vi.spyOn(ProceduralTerrain.prototype, "prepareFogMaskAsync").mockImplementation(async (pages) => {
      workerOrder.push(`fog:${pages.map(({ request }) => request.pageKey).join("+")}`);
      return null;
    });
    const terrain = new WorldmapProceduralTerrain();
    await terrain.presentAsync({ ...distantPagesInput(), commitMode: "ambient", priorityPageKeys: ["0,0"] });

    expect(workerOrder).toEqual(["page:0,0", "fog:0,0", "page:0,10", "fog:0,0+0,10"]);
    terrain.dispose();
  });

  it("settles a fully stalled superseded request without starting further worker work", async () => {
    const never = new Promise<PreparedTerrainPage>(() => undefined);
    const preparePage = vi.spyOn(ProceduralTerrain.prototype, "preparePageAsync").mockImplementation((request) => {
      if (request.pageKey === "0,0") return never;
      return Promise.resolve(prepareTerrainPage(request));
    });
    vi.spyOn(ProceduralTerrain.prototype, "prepareFogMaskAsync").mockResolvedValue(null);
    const terrain = new WorldmapProceduralTerrain();
    const superseded = terrain.presentAsync({
      ...distantPagesInput(),
      cells: [...distantPagesInput().cells, worldCell(20, 0, BiomeType.Taiga)],
      commitMode: "ambient",
    });
    await flushMicrotasks();
    expect(preparePage.mock.calls.map(([request]) => request.pageKey)).toEqual(["0,0"]);

    const latest = terrain.presentAsync(singlePageInput(30));

    await expect(superseded).resolves.toBeNull();
    await expect(latest).resolves.toMatchObject({ pages: 1 });
    expect(preparePage.mock.calls.map(([request]) => request.pageKey)).toEqual(["0,0", "0,30"]);
    terrain.dispose();
  });

  it("settles stalled callers when cleared or disposed", async () => {
    for (const stop of ["clear", "dispose"] as const) {
      vi.restoreAllMocks();
      vi.spyOn(ProceduralTerrain.prototype, "preparePageAsync").mockReturnValue(
        new Promise<PreparedTerrainPage>(() => undefined),
      );
      const terrain = new WorldmapProceduralTerrain();
      const presentation = terrain.presentAsync(singlePageInput(0));
      await flushMicrotasks();

      terrain[stop]();

      await expect(presentation).resolves.toBeNull();
      expect(terrain.getPresentationCoverage().pages).toEqual([]);
      if (stop === "clear") terrain.dispose();
    }
  });

  it("propagates a worker rejection and allows the same target to retry", async () => {
    const preparePage = vi
      .spyOn(ProceduralTerrain.prototype, "preparePageAsync")
      .mockRejectedValueOnce(new Error("injected worker failure"))
      .mockImplementation((request) => Promise.resolve(prepareTerrainPage(request)));
    vi.spyOn(ProceduralTerrain.prototype, "prepareFogMaskAsync").mockResolvedValue(null);
    const terrain = new WorldmapProceduralTerrain();

    await expect(terrain.presentAsync(singlePageInput(0))).rejects.toThrow("injected worker failure");
    await expect(terrain.presentAsync(singlePageInput(0))).resolves.toMatchObject({ builtPages: 1, pages: 1 });
    expect(preparePage).toHaveBeenCalledTimes(2);
    terrain.dispose();
  });

  it("commits every page affected by one authoritative boundary change in one task", async () => {
    stubPageWorker();
    const scheduler = createRecordingScheduler();
    const commitPages = vi.spyOn(ProceduralTerrain.prototype, "commitPages");
    const terrain = new WorldmapProceduralTerrain();
    const input = twoPageInput();
    await terrain.presentAsync(input, scheduler);
    scheduler.owners.length = 0;

    const changed = { ...input, cells: [worldCell(1, 0, BiomeType.Taiga), input.cells[1]] };
    await terrain.presentAsync(changed, scheduler);

    expect(scheduler.owners.filter(isPageStep)).toEqual(["terrain:present:page"]);
    expect(commitPages.mock.lastCall?.[0].map(({ request }) => request.pageKey)).toEqual(["0,0", "0,2"]);
    const west = terrainHexToWorld(1, 0);
    const east = terrainHexToWorld(2, 0);
    expect(terrain.sampleSurface(west.x, west.z).biome).toBe(BiomeType.Taiga);
    expect(terrain.sampleSurface(east.x, east.z).biome).toBe(BiomeType.Beach);
    terrain.dispose();
  });

  it("reports requested, source-ready, complete-page, and converged-window milestones", async () => {
    stubPageWorker();
    const terrain = new WorldmapProceduralTerrain();
    const events: TerrainPresentationEvent[] = [];

    const presentation = terrain.presentAsync(singlePageInput(0), undefined, (event) => events.push(event));
    expect(events).toEqual([expect.objectContaining({ kind: "requested", revision: 1 })]);
    await presentation;

    expect(events.map(({ kind }) => kind)).toEqual(["requested", "source_ready", "page_complete", "window_complete"]);
    const sourceReady = events.find((event) => event.kind === "source_ready");
    const pageComplete = events.find((event) => event.kind === "page_complete");
    expect(sourceReady).toMatchObject({ requestedPages: [{ fingerprint: null, pageKey: "0,0" }] });
    expect(pageComplete).toMatchObject({
      completedPageKeys: ["0,0"],
      coverage: { fog: true, geometry: true, props: "stored" },
      pageKey: "0,0",
      requiredPageKeys: ["0,0"],
      work: { source: "built" },
    });
    if (pageComplete?.kind === "page_complete") {
      expect(pageComplete.fingerprint.length).toBeLessThan(100);
      expect(Number.isFinite(pageComplete.completedAtMs)).toBe(true);
      expect(Number.isFinite(pageComplete.sourceReadyAtMs)).toBe(true);
    }
    expect(terrain.getPresentationCoverage()).toMatchObject({
      pages: [{ coverage: { props: "stored" }, pageKey: "0,0" }],
      revision: 1,
    });
    terrain.dispose();
  });

  it("keeps a missing worker duration missing in page, window, and public diagnostics", async () => {
    vi.spyOn(ProceduralTerrain.prototype, "preparePageAsync").mockImplementation(async (request) => {
      const page = prepareTerrainPage(request);
      return { ...page, diagnostics: { ...page.diagnostics, prepareMs: Number.NaN } };
    });
    vi.spyOn(ProceduralTerrain.prototype, "prepareFogMaskAsync").mockResolvedValue(null);
    const terrain = new WorldmapProceduralTerrain();
    const events: TerrainPresentationEvent[] = [];

    const diagnostics = await terrain.presentAsync(singlePageInput(0), undefined, (event) => events.push(event));

    expect(diagnostics?.prepareMs).toBe(Number.NaN);
    expect(events.find((event) => event.kind === "page_complete")).toMatchObject({
      work: { workerBuildMs: null },
    });
    expect(events.find((event) => event.kind === "window_complete")).toMatchObject({
      work: { workerBuildMs: null },
    });
    terrain.dispose();
  });

  it("reports known no-op work as zero in a mixed cached and built atomic window", async () => {
    stubPageWorker();
    const terrain = new WorldmapProceduralTerrain();
    const input = distantPagesInput();
    await terrain.presentAsync(input);
    const events: TerrainPresentationEvent[] = [];
    const changed = { ...input, cells: [input.cells[0], { ...input.cells[1], occupied: true }] };

    await terrain.presentAsync(changed, undefined, (event) => events.push(event));

    const pageEvents = events.filter((event) => event.kind === "page_complete");
    expect(pageEvents).toHaveLength(2);
    expect(pageEvents.find((event) => event.pageKey === "0,0")).toMatchObject({
      commitCpuMs: 0,
      work: { queueWaitMs: 0, source: "cache", workerBuildMs: 0 },
    });
    const built = pageEvents.find((event) => event.pageKey === "0,10");
    expect(built).toMatchObject({ work: { source: "built" } });
    if (built?.kind === "page_complete") {
      expect(Number.isFinite(built.commitCpuMs)).toBe(true);
      expect(Number.isFinite(built.work.queueWaitMs)).toBe(true);
    }
    expect(events.find((event) => event.kind === "window_complete")).toMatchObject({
      work: {
        builtPages: 1,
        queueWaitMs: expect.any(Number),
        reusedPages: 1,
        workerBuildMs: expect.any(Number),
      },
    });
    terrain.dispose();
  });

  it("keeps a full ambient window bounded while replacing all sixteen pages", async () => {
    stubPageWorker();
    const terrain = new WorldmapProceduralTerrain();
    await terrain.loadProps();
    const inputForColumns = (startCol: number) => ({
      cells: Array.from({ length: 16 }, (_, offset) => worldCell(startCol + offset, 0, BiomeType.Grassland)),
      climate: NEUTRAL_BIOME_CLIMATE,
      commitMode: "ambient" as const,
      mapCenter: 0,
      pageHeight: 1,
      pageOrigin: { col: 0, row: 0 },
      pageWidth: 1,
      subdivisions: 1,
    });
    await terrain.presentAsync(inputForColumns(0));
    await terrain.presentAsync(inputForColumns(16));

    const coverage = terrain.getPresentationCoverage();
    expect(coverage.pages).toHaveLength(16);
    expect(new Set(coverage.pages.map(({ pageKey }) => pageKey))).toEqual(
      new Set(Array.from({ length: 16 }, (_, offset) => `0,${16 + offset}`)),
    );
    expect(coverage.pages.every(({ coverage: page }) => page.props === "uploaded")).toBe(true);
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

function createControlledScheduler(): FrameBudgetWorkScheduler & {
  runAll(): Promise<void>;
  runUntil(owner: string): Promise<void>;
} {
  const tasks: Array<{ owner: string; run(): Promise<void> }> = [];
  const runNext = async () => {
    await flushMicrotasks();
    const task = tasks.shift();
    if (!task) return null;
    await task.run();
    return task.owner;
  };
  return {
    schedule(_lane, work, owner) {
      return new Promise((resolve, reject) => {
        tasks.push({
          owner: owner ?? "",
          async run() {
            try {
              resolve(await work());
            } catch (error) {
              reject(error);
            }
          },
        });
      });
    },
    async runAll() {
      for (let idlePasses = 0; idlePasses < 3; ) {
        if (await runNext()) idlePasses = 0;
        else idlePasses += 1;
      }
    },
    async runUntil(owner) {
      for (let attempts = 0; attempts < 50; attempts += 1) {
        if ((await runNext()) === owner) return;
      }
      throw new Error(`Scheduled terrain task did not run: ${owner}`);
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
