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
import type { TerrainFogMask } from "./terrain-fog-mask";
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
  presentPageWritesMaxMs: number;
  presentRequestsMaxMs: number;
  presentTaskMaxMs: number;
  presentTasks: number;
}

type TerrainPresentStep =
  | "terrain:present:partition"
  | "terrain:present:roads"
  | "terrain:present:request"
  | "terrain:present:release"
  | "terrain:present:page"
  | "terrain:present:page-writes"
  | "terrain:present:fog";

type TerrainPresentStepMetric =
  | "presentFogMaxMs"
  | "presentPageTaskMaxMs"
  | "presentPageWritesMaxMs"
  | "presentRequestsMaxMs";

interface PresentationRun {
  readonly revision: number;
  readonly scheduler: FrameBudgetWorkScheduler | undefined;
  taskMs: number;
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
  visibleCellCount: number;
}

interface WorldBounds {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
}

const BIOME_VALUES = new Set<string>(Object.values(BiomeType));
const ROAD_PAGE_PADDING = 1.5;
const PRESENT_STEP_METRIC: Record<TerrainPresentStep, TerrainPresentStepMetric> = {
  "terrain:present:fog": "presentFogMaxMs",
  "terrain:present:page": "presentPageTaskMaxMs",
  "terrain:present:page-writes": "presentPageWritesMaxMs",
  "terrain:present:partition": "presentRequestsMaxMs",
  "terrain:present:release": "presentPageTaskMaxMs",
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
  private readonly terrain = new ProceduralTerrain();
  private readonly preparedBySignature = new Map<string, PreparedTerrainPage>();
  private readonly pendingBySignature = new Map<string, Promise<PreparedTerrainPage>>();
  private readonly presentMetrics: TerrainPresentMetrics = {
    presentFogMaxMs: 0,
    presentPageTaskMaxMs: 0,
    presentPageWritesMaxMs: 0,
    presentRequestsMaxMs: 0,
    presentTaskMaxMs: 0,
    presentTasks: 0,
  };
  private currentRequestSignatures = new Set<string>();
  private previousRequestSignatures = new Set<string>();
  private presentationRevision = 0;
  private visibleCellCount = 0;

  constructor() {
    this.object3d = this.terrain.object3d;
    this.object3d.name = "worldmap-procedural-terrain";
  }

  /**
   * Presents the composite as a chain of critical-lane tasks — partition, roads, one request per page, worker
   * builds, release, one commit per changed page, fog — so no single task outgrows the frame budget. Without a
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

  sampleSurface(worldX: number, worldZ: number): TerrainSurfaceSample {
    return this.terrain.sampleSurface(worldX, worldZ);
  }

  getUploadMetrics(): TerrainUploadMetrics {
    return this.terrain.getUploadMetrics();
  }

  getPresentMetrics(): TerrainPresentMetrics {
    return { ...this.presentMetrics };
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
    const preparations = await Promise.all(
      partition.pages.map((page) =>
        this.runStep(run, "terrain:present:request", () =>
          signPageRequest(buildWorldmapTerrainPageRequest(input, partition, page, roadSegments)),
        ),
      ),
    );
    this.retainRequestedPages(preparations);
    const reuse = this.countPageReuse(preparations);
    const preparedPages = await Promise.all(preparations.map((preparation) => this.resolvePreparedPage(preparation)));
    this.requireCurrent(run);
    const fogMask = await this.terrain.prepareFogMaskAsync(preparedPages);
    this.requireCurrent(run);
    const presentation = await this.commitPreparedPages(run, preparedPages, fogMask);
    this.visibleCellCount = partition.visibleCellCount;
    return {
      ...presentation,
      ...reuse,
      ...summarizePreparedPages(preparedPages),
      preparedCachePages: this.preparedBySignature.size,
    };
  }

  /** Release, then every changed page, then fog — queued together so the lane drains them in that order. */
  private async commitPreparedPages(
    run: PresentationRun,
    preparedPages: PreparedTerrainPage[],
    fogMask: TerrainFogMask | null,
  ): Promise<TerrainPresentationDiagnostics & { commitMs: number }> {
    const taskMsBeforeCommit = run.taskMs;
    const changedPages = preparedPages.filter((page) => !this.terrain.isPagePresented(page));
    const release = this.runStep(run, "terrain:present:release", () => this.terrain.beginPresentation(preparedPages));
    const pages = changedPages.flatMap((page) => [
      this.runStep(run, "terrain:present:page", () => this.terrain.presentPageGeometry(page)),
      this.runStep(run, "terrain:present:page-writes", () => this.terrain.presentPageWrites(page)),
    ]);
    const presentation = this.runStep(run, "terrain:present:fog", () =>
      this.terrain.finishPresentation(preparedPages, fogMask),
    );
    await Promise.all([release, ...pages, presentation]);
    return { ...(await presentation), commitMs: run.taskMs - taskMsBeforeCommit };
  }

  private beginPresentationRun(scheduler: FrameBudgetWorkScheduler | undefined): PresentationRun {
    this.presentationRevision += 1;
    return { revision: this.presentationRevision, scheduler, taskMs: 0 };
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

  private retainRequestedPages(preparations: readonly TerrainPagePreparation[]): void {
    this.previousRequestSignatures = this.currentRequestSignatures;
    this.currentRequestSignatures = new Set(preparations.map(({ signature }) => signature));
    this.prunePreparedCache();
  }

  private countPageReuse(preparations: readonly TerrainPagePreparation[]): TerrainPageReuse {
    const reusedPages = preparations.filter(
      ({ signature }) => this.preparedBySignature.has(signature) || this.pendingBySignature.has(signature),
    ).length;
    return { builtPages: preparations.length - reusedPages, reusedPages };
  }

  private resolvePreparedPage(preparation: TerrainPagePreparation): Promise<PreparedTerrainPage> {
    const cached = this.preparedBySignature.get(preparation.signature);
    if (cached) return Promise.resolve(cached);
    return this.pendingBySignature.get(preparation.signature) ?? this.preparePageAsync(preparation);
  }

  private preparePageAsync(preparation: TerrainPagePreparation): Promise<PreparedTerrainPage> {
    const pending = this.terrain
      .preparePageAsync(preparation.request)
      .then((prepared) => {
        this.retainPreparedPage(preparation.signature, prepared);
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

  private retainPreparedPage(signature: string, prepared: PreparedTerrainPage): void {
    if (this.isRetainedRequest(signature)) this.preparedBySignature.set(signature, prepared);
  }

  private prunePreparedCache(): void {
    for (const signature of this.preparedBySignature.keys()) {
      if (!this.isRetainedRequest(signature)) this.preparedBySignature.delete(signature);
    }
  }

  private isRetainedRequest(signature: string): boolean {
    return this.currentRequestSignatures.has(signature) || this.previousRequestSignatures.has(signature);
  }

  private clearPreparedWork(): void {
    this.preparedBySignature.clear();
    this.pendingBySignature.clear();
    this.currentRequestSignatures.clear();
    this.previousRequestSignatures.clear();
  }
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
  let visibleCellCount = 0;
  // Bucketing is linear; each page sorts its own cells inside its request task.
  for (const cell of cells) {
    resolvePageCells(pagesByKey, cell, input).cells.push(cell);
    cellsByKey.set(hexCellKey(cell.col, cell.row), cell);
    if (cell.explored) visibleCellCount += 1;
  }
  return {
    cells,
    cellsByKey,
    pages: Array.from(pagesByKey.values()).toSorted(
      (left, right) => left.startRow - right.startRow || left.startCol - right.startCol,
    ),
    visibleCellCount,
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
