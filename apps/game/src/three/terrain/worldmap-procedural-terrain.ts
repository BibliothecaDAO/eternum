import { NEUTRAL_BIOME_CLIMATE, type BiomeClimateConfig } from "@bibliothecadao/eternum";
import { BiomeType, getNeighborHexes } from "@bibliothecadao/types";
import type { Group } from "three";

import {
  isFrameBudgetWorkQueueDisposedError,
  scheduleFrameBudgetWork,
  type FrameBudgetWorkScheduler,
} from "../frame-budget-work-queue";
import {
  ProceduralTerrain,
  type TerrainPresentationDiagnostics,
  type TerrainUploadMetrics,
} from "./procedural-terrain";
import { hexCellKey } from "./hex-cell-key";
import { terrainHexToWorld, type TerrainWorldCoordinate } from "./terrain-coordinates";
import { buildTerrainRoadSegments } from "./terrain-roads";
import { MAX_TERRAIN_SETTLEMENT_INFLUENCE_RADIUS } from "./terrain-settlements";
import type {
  PreparedTerrainPage,
  TerrainCellInput,
  TerrainPageRequest,
  TerrainRoadAnchor,
  TerrainRoadSegment,
  TerrainSettlementAnchor,
  TerrainSurfaceSample,
} from "./terrain-types";
import type { TerrainPropLod } from "./terrain-prop-catalog";
import type { TerrainQualityTier } from "./terrain-quality";
import type { TerrainFogFieldStats } from "./terrain-fog-field";
import type { TerrainMovementInteraction } from "./terrain-movement-effects";

interface WorldmapProceduralCell {
  biomeKey: string;
  col: number;
  occupied: boolean;
  row: number;
}

export interface WorldmapProceduralPresentationInput {
  cells: readonly WorldmapProceduralCell[];
  climate?: BiomeClimateConfig;
  mapCenter: number;
  pageHeight: number;
  pageOrigin: { col: number; row: number };
  pageWidth: number;
  priorityPageKeys?: readonly string[];
  visiblePageKeys?: readonly string[];
  criticalPageKeys?: readonly string[];
  onCriticalPagesReady?: () => void;
  propDensityMultiplier?: number;
  roadAnchors?: readonly TerrainRoadAnchor[];
  settlementAnchors?: readonly TerrainSettlementAnchor[];
  subdivisions?: number;
}

export interface WorldmapProceduralPresentationDiagnostics extends TerrainPresentationDiagnostics {
  biomeMismatchCount: number;
  builtPages: number;
  /** Main-thread ms the release, page, and fog steps of this presentation took together. */
  commitMs: number;
  preparedCachePages: number;
  prepareMs: number;
  reusedPages: number;
}

/** Cumulative count and per-kind maxima of the main-thread time one presentation step took. */
export interface TerrainPresentMetrics {
  presentFogMaxMs: number;
  presentPageTaskMaxMs: number;
  presentRequestsMaxMs: number;
  presentTaskMaxMs: number;
  presentTasks: number;
}

type TerrainPresentStep =
  | "terrain:present:partition"
  | "terrain:present:roads"
  | "terrain:present:request"
  | "terrain:present:page"
  | "terrain:present:fog";

type TerrainPresentStepMetric = "presentFogMaxMs" | "presentPageTaskMaxMs" | "presentRequestsMaxMs";

interface PresentationRun {
  readonly revision: number;
  readonly scheduler: FrameBudgetWorkScheduler | undefined;
  taskMs: number;
  criticalPagesReady: boolean;
}

interface TerrainPagePreparation {
  request: TerrainPageRequest;
  signature: string;
}

interface TerrainPageReuse {
  builtPages: number;
  reusedPages: number;
}

interface WorldmapTerrainPageCells {
  cells: TerrainCellInput[];
  pageKey: string;
  startCol: number;
  startRow: number;
}

/** The whole-window part of a request build, shared by every page request. */
interface WorldmapTerrainPagePartition {
  cells: TerrainCellInput[];
  cellsByKey: ReadonlyMap<number, TerrainCellInput>;
  pages: WorldmapTerrainPageCells[];
}

interface WorldBounds {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
}

const BIOME_VALUES = new Set<string>(Object.values(BiomeType));
// Four complete 4x4 camera windows let ordinary out-and-back pans reuse the expensive worker result. The GPU still
// presents only the active window; this cache holds CPU-side typed arrays and evicts least-recently-used signatures.
const PREPARED_PAGE_CACHE_LIMIT = 64;
const ROAD_PAGE_PADDING = 1.5;
const PRESENT_STEP_METRIC: Record<TerrainPresentStep, TerrainPresentStepMetric> = {
  "terrain:present:fog": "presentFogMaxMs",
  "terrain:present:page": "presentPageTaskMaxMs",
  "terrain:present:partition": "presentRequestsMaxMs",
  "terrain:present:request": "presentRequestsMaxMs",
  "terrain:present:roads": "presentRequestsMaxMs",
};

class SupersededPresentationError extends Error {
  constructor() {
    super("Terrain presentation was superseded");
    this.name = "SupersededPresentationError";
  }
}

export class WorldmapProceduralTerrain {
  readonly object3d: Group;
  private readonly terrain = new ProceduralTerrain({ streaming: true });
  private readonly preparedBySignature = new Map<string, PreparedTerrainPage>();
  private readonly pendingBySignature = new Map<string, Promise<PreparedTerrainPage>>();
  private readonly presentMetrics: TerrainPresentMetrics = {
    presentFogMaxMs: 0,
    presentPageTaskMaxMs: 0,
    presentRequestsMaxMs: 0,
    presentTaskMaxMs: 0,
    presentTasks: 0,
  };
  private preparedCacheRevision = 0;
  private presentationRevision = 0;
  private visibleCellCount = 0;

  constructor() {
    this.object3d = this.terrain.object3d;
    this.object3d.name = "worldmap-procedural-terrain";
  }

  /**
   * Presents the composite as a chain of critical-lane tasks — partition, roads, one request per page, worker
   * builds, then progressive page commits with matching fog. Without a
   * scheduler every step runs inline. Resolves null once a newer presentation, `clear`, or `dispose` supersedes
   * this one, or the queue is disposed; pages committed before that stay valid until a later presentation
   * replaces or releases them.
   */
  async presentAsync(
    input: WorldmapProceduralPresentationInput,
    scheduler?: FrameBudgetWorkScheduler,
  ): Promise<WorldmapProceduralPresentationDiagnostics | null> {
    const run = this.beginPresentationRun(scheduler);
    try {
      return await this.runPresentation(run, input);
    } catch (error) {
      if (error instanceof SupersededPresentationError || isFrameBudgetWorkQueueDisposedError(error)) return null;
      throw error;
    }
  }

  loadProps(): Promise<void> {
    return this.terrain.loadProps();
  }

  loadGroundTextures(): Promise<void> {
    return this.terrain.loadGroundTextures();
  }

  setPropLod(lod: TerrainPropLod): void {
    this.terrain.setPropLod(lod);
  }

  setGroundTextureDetailEnabled(enabled: boolean): void {
    this.terrain.setGroundTextureDetailEnabled(enabled);
  }

  setQualityTier(tier: TerrainQualityTier): void {
    this.terrain.setQualityTier(tier);
  }

  queueShroudReveal(col: number, row: number): void {
    this.terrain.queueShroudReveal(col, row);
  }

  update(deltaSeconds: number): void {
    this.terrain.update(deltaSeconds);
  }

  getShroudStats(): TerrainFogFieldStats {
    return this.terrain.getShroudStats();
  }

  setMovementInteractions(interactions: readonly TerrainMovementInteraction[]): void {
    this.terrain.setMovementInteractions(interactions);
  }

  refreshPropOccupancy(isOccupied: (col: number, row: number) => boolean): void {
    this.terrain.refreshPropOccupancy(isOccupied);
  }

  sampleSurface(worldX: number, worldZ: number): TerrainSurfaceSample {
    return this.terrain.sampleSurface(worldX, worldZ);
  }

  getUploadMetrics(): TerrainUploadMetrics {
    return this.terrain.getUploadMetrics();
  }

  getPresentMetrics(): TerrainPresentMetrics {
    return { ...this.presentMetrics };
  }

  getPresentedPageKeys(): string[] {
    return this.terrain.getPresentedPages().map((page) => page.request.pageKey);
  }

  getVisibleCellCount(): number {
    return this.visibleCellCount;
  }

  clear(): void {
    this.presentationRevision += 1;
    this.terrain.present([]);
    this.clearPreparedWork();
    this.visibleCellCount = 0;
  }

  dispose(): void {
    this.presentationRevision += 1;
    this.clearPreparedWork();
    this.visibleCellCount = 0;
    this.terrain.dispose();
  }

  private async runPresentation(
    run: PresentationRun,
    input: WorldmapProceduralPresentationInput,
  ): Promise<WorldmapProceduralPresentationDiagnostics> {
    const partition = await this.runStep(run, "terrain:present:partition", () => partitionWorldmapTerrainPages(input));
    const roadSegments = await this.runStep(run, "terrain:present:roads", () =>
      buildWorldmapTerrainRoadSegments(input, partition),
    );
    const unorderedPreparations = await Promise.all(
      partition.pages.map((page) =>
        this.runStep(run, "terrain:present:request", () =>
          signPageRequest(buildWorldmapTerrainPageRequest(input, partition, page, roadSegments)),
        ),
      ),
    );
    const preparations = prioritizePagePreparations(unorderedPreparations, input.priorityPageKeys);
    const reuse = this.countPageReuse(preparations);
    const desiredKeys = new Set(preparations.map(({ request }) => request.pageKey));
    const visiblePages = new Map(
      this.terrain
        .getPresentedPages()
        .filter((page) => desiredKeys.has(page.request.pageKey))
        .map((page) => [page.request.pageKey, page]),
    );
    const preparedPages: PreparedTerrainPage[] = [];
    this.notifyCriticalPagesReady(run, input, preparations);
    let commitMs = 0;
    let pendingPage: Promise<PreparedTerrainPage> | undefined;
    // New camera coverage streams immediately. Replacements of existing pages commit together, so one game
    // update affecting a shared edge or settlement never exposes a partially updated result.
    for (const [index, preparation] of preparations.entries()) {
      this.requireCurrent(run);
      const prepared = await (pendingPage ?? this.resolvePreparedPage(preparation));
      this.requireCurrent(run);
      preparedPages.push(prepared);
      let commit: Promise<TerrainPresentationDiagnostics & { commitMs: number }> | undefined;
      if (!visiblePages.has(prepared.request.pageKey)) {
        visiblePages.set(prepared.request.pageKey, prepared);
        commit = this.commitPreparedPages(run, Array.from(visiblePages.values()));
      }
      // Queue only one page ahead, after the current fog job, so preparation can overlap the main-thread commit.
      pendingPage = this.prepareNextPage(preparations[index + 1]);
      if (commit) {
        const result = await commit;
        commitMs += result.commitMs;
        this.notifyCriticalPagesReady(run, input, preparations);
      }
    }
    const presentation = await this.commitPreparedPages(run, preparedPages);
    this.notifyCriticalPagesReady(run, input, preparations);
    return {
      ...presentation,
      ...reuse,
      ...summarizePreparedPages(preparedPages),
      commitMs: commitMs + presentation.commitMs,
      preparedCachePages: this.preparedBySignature.size,
    };
  }

  private notifyCriticalPagesReady(
    run: PresentationRun,
    input: WorldmapProceduralPresentationInput,
    preparations: readonly TerrainPagePreparation[],
  ): void {
    if (run.criticalPagesReady || !input.onCriticalPagesReady || !input.criticalPageKeys?.length) return;
    const ready = input.criticalPageKeys.every((key) => {
      const preparation = preparations.find(({ request }) => request.pageKey === key);
      const prepared = preparation && this.preparedBySignature.get(preparation.signature);
      return prepared !== undefined && this.terrain.isPagePresented(prepared);
    });
    if (!ready) return;
    run.criticalPagesReady = true;
    input.onCriticalPagesReady();
  }

  /** Prepare the matching mask before swapping geometry, props, and fog in one visible step. */
  private async commitPreparedPages(
    run: PresentationRun,
    preparedPages: PreparedTerrainPage[],
  ): Promise<TerrainPresentationDiagnostics & { commitMs: number }> {
    const fogMask = await this.terrain.prepareFogMaskAsync(preparedPages);
    this.requireCurrent(run);
    const changedPages = preparedPages.filter((page) => !this.terrain.isPagePresented(page));
    const taskMsBeforeCommit = run.taskMs;
    const presentation = await this.runStep(
      run,
      changedPages.length ? "terrain:present:page" : "terrain:present:fog",
      () => {
        this.terrain.beginPresentation(preparedPages);
        changedPages.forEach((page) => this.terrain.presentPage(page));
        const result = this.terrain.finishPresentation(preparedPages, fogMask);
        this.visibleCellCount = preparedPages.reduce(
          (count, page) => count + page.request.cells.filter((cell) => cell.explored).length,
          0,
        );
        return result;
      },
    );
    return { ...presentation, commitMs: run.taskMs - taskMsBeforeCommit };
  }

  private beginPresentationRun(scheduler: FrameBudgetWorkScheduler | undefined): PresentationRun {
    this.presentationRevision += 1;
    return { revision: this.presentationRevision, scheduler, taskMs: 0, criticalPagesReady: false };
  }

  private runStep<T>(run: PresentationRun, step: TerrainPresentStep, work: () => T): Promise<T> {
    return scheduleFrameBudgetWork(run.scheduler, "critical", () => this.runCurrentStep(run, step, work), step);
  }

  private runCurrentStep<T>(run: PresentationRun, step: TerrainPresentStep, work: () => T): T {
    this.requireCurrent(run);
    const startedAt = performance.now();
    try {
      return work();
    } finally {
      const durationMs = performance.now() - startedAt;
      run.taskMs += durationMs;
      this.recordPresentStep(step, durationMs);
    }
  }

  private requireCurrent(run: PresentationRun): void {
    if (run.revision !== this.presentationRevision) throw new SupersededPresentationError();
  }

  private recordPresentStep(step: TerrainPresentStep, durationMs: number): void {
    const metrics = this.presentMetrics;
    const stepMetric = PRESENT_STEP_METRIC[step];
    metrics.presentTasks += 1;
    metrics.presentTaskMaxMs = Math.max(metrics.presentTaskMaxMs, durationMs);
    metrics[stepMetric] = Math.max(metrics[stepMetric], durationMs);
  }

  private countPageReuse(preparations: readonly TerrainPagePreparation[]): TerrainPageReuse {
    const reusedPages = preparations.filter(
      ({ signature }) => this.preparedBySignature.has(signature) || this.pendingBySignature.has(signature),
    ).length;
    return { builtPages: preparations.length - reusedPages, reusedPages };
  }

  private resolvePreparedPage(preparation: TerrainPagePreparation): Promise<PreparedTerrainPage> {
    const cached = this.preparedBySignature.get(preparation.signature);
    if (cached) {
      this.touchPreparedPage(preparation.signature, cached);
      return Promise.resolve(cached);
    }
    return this.pendingBySignature.get(preparation.signature) ?? this.preparePageAsync(preparation);
  }

  private prepareNextPage(preparation: TerrainPagePreparation | undefined): Promise<PreparedTerrainPage> | undefined {
    if (!preparation) return undefined;
    const pending = this.resolvePreparedPage(preparation);
    // A superseded commit may exit before awaiting this page. Keep its rejection handled;
    // the original promise still propagates the error when the active run consumes it.
    void pending.catch(() => undefined);
    return pending;
  }

  private preparePageAsync(preparation: TerrainPagePreparation): Promise<PreparedTerrainPage> {
    const cacheRevision = this.preparedCacheRevision;
    const pending = this.terrain
      .preparePageAsync(preparation.request)
      .then((prepared) => {
        if (cacheRevision === this.preparedCacheRevision) {
          this.touchPreparedPage(preparation.signature, prepared);
          this.prunePreparedCache();
        }
        return prepared;
      })
      .finally(() => {
        if (this.pendingBySignature.get(preparation.signature) === pending) {
          this.pendingBySignature.delete(preparation.signature);
        }
      });
    this.pendingBySignature.set(preparation.signature, pending);
    return pending;
  }

  private touchPreparedPage(signature: string, prepared: PreparedTerrainPage): void {
    this.preparedBySignature.delete(signature);
    this.preparedBySignature.set(signature, prepared);
  }

  private prunePreparedCache(): void {
    while (this.preparedBySignature.size > PREPARED_PAGE_CACHE_LIMIT) {
      const oldestSignature = this.preparedBySignature.keys().next().value;
      if (oldestSignature === undefined) return;
      this.preparedBySignature.delete(oldestSignature);
    }
  }

  private clearPreparedWork(): void {
    this.preparedCacheRevision += 1;
    this.preparedBySignature.clear();
    this.pendingBySignature.clear();
  }
}

function prioritizePagePreparations(
  preparations: readonly TerrainPagePreparation[],
  priorityPageKeys: readonly string[] | undefined,
): TerrainPagePreparation[] {
  if (!priorityPageKeys?.length) return [...preparations];
  const priorityByPageKey = new Map<string, number>();
  priorityPageKeys.forEach((pageKey, index) => {
    if (!priorityByPageKey.has(pageKey)) priorityByPageKey.set(pageKey, index);
  });
  return preparations
    .map((preparation, index) => ({
      index,
      preparation,
      priority: priorityByPageKey.get(preparation.request.pageKey) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ preparation }) => preparation);
}

/** The presentation's request build in one call: what `presentAsync` runs as partition, roads, and page steps. */
export function buildWorldmapTerrainPageRequests(input: WorldmapProceduralPresentationInput): TerrainPageRequest[] {
  const partition = partitionWorldmapTerrainPages(input);
  const roadSegments = buildWorldmapTerrainRoadSegments(input, partition);
  return partition.pages.map((page) => buildWorldmapTerrainPageRequest(input, partition, page, roadSegments));
}

function partitionWorldmapTerrainPages(input: WorldmapProceduralPresentationInput): WorldmapTerrainPagePartition {
  requirePageSize(input.pageWidth, "width");
  requirePageSize(input.pageHeight, "height");
  requirePageOrigin(input.pageOrigin);
  const cells = input.cells.map(toTerrainCell);
  const pagesByKey = new Map<number, WorldmapTerrainPageCells>();
  const cellsByKey = new Map<number, TerrainCellInput>();
  // Bucketing is linear; each page sorts its own cells inside its request task.
  for (const cell of cells) {
    resolvePageCells(pagesByKey, cell, input).cells.push(cell);
    cellsByKey.set(hexCellKey(cell.col, cell.row), cell);
  }
  return {
    cells,
    cellsByKey,
    pages: Array.from(pagesByKey.values())
      .filter((page) => !input.visiblePageKeys || input.visiblePageKeys.includes(page.pageKey))
      .toSorted((left, right) => left.startRow - right.startRow || left.startCol - right.startCol),
  };
}

function buildWorldmapTerrainRoadSegments(
  input: WorldmapProceduralPresentationInput,
  partition: WorldmapTerrainPagePartition,
): TerrainRoadSegment[] {
  return buildTerrainRoadSegments({ anchors: input.roadAnchors ?? [], cellsByKey: partition.cellsByKey });
}

function buildWorldmapTerrainPageRequest(
  input: WorldmapProceduralPresentationInput,
  partition: WorldmapTerrainPagePartition,
  page: WorldmapTerrainPageCells,
  roadSegments: readonly TerrainRoadSegment[],
): TerrainPageRequest {
  const cells = canonicalTerrainCells(page.cells);
  const bounds = resolvePageWorldBounds(cells);
  return {
    cells,
    climate: input.climate ?? NEUTRAL_BIOME_CLIMATE,
    halo: resolvePageHalo(cells, partition.cellsByKey),
    mapCenter: input.mapCenter,
    pageKey: page.pageKey,
    propDensityMultiplier: input.propDensityMultiplier,
    roadSegments: resolvePageRoadSegments(bounds, roadSegments),
    settlementAnchors: resolvePageSettlementAnchors(bounds, input.settlementAnchors ?? []),
    strictBiomeParity: false,
    subdivisions: input.subdivisions ?? 2,
  };
}

/**
 * The cache key is the whole request, so a newly landed neighbour legitimately rebuilds the pages whose halo it
 * changed. Serialising one page costs ~0.3 ms inside its own request task; a structural hash measured slower.
 */
function signPageRequest(request: TerrainPageRequest): TerrainPagePreparation {
  return { request, signature: JSON.stringify(request) };
}

function summarizePreparedPages(pages: readonly PreparedTerrainPage[]): {
  biomeMismatchCount: number;
  prepareMs: number;
} {
  return pages.reduce(
    (summary, page) => ({
      biomeMismatchCount: summary.biomeMismatchCount + page.diagnostics.biomeMismatchCount,
      prepareMs: summary.prepareMs + page.diagnostics.prepareMs,
    }),
    { biomeMismatchCount: 0, prepareMs: 0 },
  );
}

function resolvePageCells(
  pagesByKey: Map<number, WorldmapTerrainPageCells>,
  cell: TerrainCellInput,
  input: WorldmapProceduralPresentationInput,
): WorldmapTerrainPageCells {
  const startCol = resolvePageStart(cell.col, input.pageOrigin.col, input.pageWidth);
  const startRow = resolvePageStart(cell.row, input.pageOrigin.row, input.pageHeight);
  const key = hexCellKey(startCol, startRow);
  let page = pagesByKey.get(key);
  if (!page) {
    page = { cells: [], pageKey: `${startRow},${startCol}`, startCol, startRow };
    pagesByKey.set(key, page);
  }
  return page;
}

function resolvePageStart(coordinate: number, origin: number, size: number): number {
  return Math.floor((coordinate - origin) / size) * size + origin;
}

function resolvePageHalo(
  pageCells: readonly TerrainCellInput[],
  cellsByKey: ReadonlyMap<number, TerrainCellInput>,
): TerrainCellInput[] {
  const ownedKeys = new Set(pageCells.map((cell) => hexCellKey(cell.col, cell.row)));
  const haloByKey = new Map<number, TerrainCellInput>();
  for (const cell of pageCells) {
    for (const neighbor of getNeighborHexes(cell.col, cell.row)) {
      const key = hexCellKey(neighbor.col, neighbor.row);
      const candidate = cellsByKey.get(key);
      if (candidate && !ownedKeys.has(key)) haloByKey.set(key, candidate);
    }
  }
  return canonicalTerrainCells(Array.from(haloByKey.values()));
}

function resolvePageRoadSegments(
  bounds: WorldBounds,
  roadSegments: readonly TerrainRoadSegment[],
): TerrainRoadSegment[] {
  const reach = expandWorldBounds(bounds, ROAD_PAGE_PADDING);
  return roadSegments.filter(
    ({ start, end }) =>
      Math.max(start[0], end[0]) >= reach.minX &&
      Math.min(start[0], end[0]) <= reach.maxX &&
      Math.max(start[1], end[1]) >= reach.minZ &&
      Math.min(start[1], end[1]) <= reach.maxZ,
  );
}

function resolvePageSettlementAnchors(
  bounds: WorldBounds,
  anchors: readonly TerrainSettlementAnchor[],
): TerrainSettlementAnchor[] {
  const reach = expandWorldBounds(bounds, MAX_TERRAIN_SETTLEMENT_INFLUENCE_RADIUS);
  return anchors
    .filter(({ col, row }) => containsWorldPoint(reach, terrainHexToWorld(col, row)))
    .toSorted((left, right) => left.structureId.localeCompare(right.structureId));
}

function resolvePageWorldBounds(cells: readonly TerrainCellInput[]): WorldBounds {
  const bounds = { maxX: -Infinity, maxZ: -Infinity, minX: Infinity, minZ: Infinity };
  for (const { col, row } of cells) {
    const { x, z } = terrainHexToWorld(col, row);
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minZ = Math.min(bounds.minZ, z);
    bounds.maxZ = Math.max(bounds.maxZ, z);
  }
  return bounds;
}

function expandWorldBounds(bounds: WorldBounds, padding: number): WorldBounds {
  return {
    maxX: bounds.maxX + padding,
    maxZ: bounds.maxZ + padding,
    minX: bounds.minX - padding,
    minZ: bounds.minZ - padding,
  };
}

function containsWorldPoint(bounds: WorldBounds, point: TerrainWorldCoordinate): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.z >= bounds.minZ && point.z <= bounds.maxZ;
}

function toTerrainCell(cell: WorldmapProceduralCell): TerrainCellInput {
  const biome = resolveBiomeKey(cell.biomeKey);
  return {
    biome,
    col: cell.col,
    explored: biome !== null,
    occupied: cell.occupied,
    previewBiome: biome,
    row: cell.row,
  };
}

function resolveBiomeKey(biomeKey: string): BiomeType | null {
  if (biomeKey === "Outline" || biomeKey === "Empty") return null;
  const normalized = biomeKey.endsWith("Alt") ? biomeKey.slice(0, -3) : biomeKey;
  return BIOME_VALUES.has(normalized) && normalized !== BiomeType.None ? (normalized as BiomeType) : null;
}

function canonicalTerrainCells(cells: readonly TerrainCellInput[]): TerrainCellInput[] {
  return cells.toSorted((left, right) => left.row - right.row || left.col - right.col);
}

function requirePageOrigin(origin: WorldmapProceduralPresentationInput["pageOrigin"]): void {
  if (!Number.isInteger(origin.col) || !Number.isInteger(origin.row)) {
    throw new Error("Worldmap procedural terrain page origin must use integer coordinates");
  }
}

function requirePageSize(value: number, axis: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Worldmap procedural terrain page ${axis} must be a positive integer`);
  }
}
