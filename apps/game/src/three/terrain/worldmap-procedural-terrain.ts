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
import { TERRAIN_PROP_POOL_PAGE_SLOTS } from "./terrain-prop-pools";
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
  /** Authoritative content changes commit together; camera coverage can stream as ambient pages become ready. */
  commitMode?: "atomic" | "ambient";
  mapCenter: number;
  pageHeight: number;
  pageOrigin: { col: number; row: number };
  pageWidth: number;
  priorityPageKeys?: readonly string[];
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
  presentPageTaskMaxMs: number;
  presentRequestsMaxMs: number;
  presentTaskMaxMs: number;
  presentTasks: number;
}

export type TerrainPagePreparationSource = "built" | "cache" | "shared_in_flight";

export type TerrainPresentationEvent =
  | {
      kind: "requested";
      requestedAtMs: number;
      revision: number;
    }
  | {
      kind: "source_ready";
      requestedPages: Array<{ fingerprint: null; pageKey: string }>;
      revision: number;
      sourceReadyAtMs: number;
    }
  | {
      commitCpuMs: number | null;
      completedAtMs: number;
      completedPageKeys: string[];
      coverage: { fog: true; geometry: true; props: "stored" | "uploaded" };
      fingerprint: string;
      kind: "page_complete";
      pageKey: string;
      requiredPageKeys: string[];
      revision: number;
      sourceReadyAtMs: number;
      work: {
        queueWaitMs: number | null;
        source: TerrainPagePreparationSource;
        workerBuildMs: number | null;
      };
    }
  | {
      completedAtMs: number;
      completedPageKeys: string[];
      kind: "window_complete";
      requiredPageKeys: string[];
      revision: number;
      work: {
        builtPages: number;
        queueWaitMs: number | null;
        reusedPages: number;
        sharedInFlightPages: number;
        workerBuildMs: number | null;
      };
    };

export type TerrainPresentationObserver = (event: TerrainPresentationEvent) => void;

export interface TerrainPresentationCoverage {
  pages: Array<{
    coverage: { fog: true; geometry: true; props: "stored" | "uploaded" };
    fingerprint: string;
    pageKey: string;
    revision: number;
  }>;
  revision: number;
}

type TerrainPresentStep =
  | "terrain:present:partition"
  | "terrain:present:roads"
  | "terrain:present:request"
  | "terrain:present:release"
  | "terrain:present:page";

type TerrainPresentStepMetric = "presentPageTaskMaxMs" | "presentRequestsMaxMs";

interface PresentationRun {
  builtPages: number;
  readonly cancelled: Promise<never>;
  readonly completedPageKeys: Set<string>;
  readonly observer: TerrainPresentationObserver | undefined;
  requiredPageKeys: string[];
  readonly revision: number;
  readonly scheduler: FrameBudgetWorkScheduler | undefined;
  queueWaitMs: number | null;
  sharedInFlightPages: number;
  sourceReadyAtMs: number | null;
  taskMs: number;
  commitMs: number;
  workerBuildMs: number | null;
}

interface TerrainPagePreparation {
  request: TerrainPageRequest;
  signature: string;
}

interface ResolvedTerrainPage {
  page: PreparedTerrainPage;
  signature: string;
  source: TerrainPagePreparationSource;
  workerBuildMs: number | null;
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
  "terrain:present:page": "presentPageTaskMaxMs",
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
    presentPageTaskMaxMs: 0,
    presentRequestsMaxMs: 0,
    presentTaskMaxMs: 0,
    presentTasks: 0,
  };
  private preparedCacheRevision = 0;
  private presentationRevision = 0;
  private cancelActiveRun: (() => void) | null = null;
  private readonly presentedPages = new Map<
    string,
    { page: PreparedTerrainPage; revision: number; signature: string }
  >();
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
    observer?: TerrainPresentationObserver,
  ): Promise<WorldmapProceduralPresentationDiagnostics | null> {
    const run = this.beginPresentationRun(scheduler, observer);
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

  getPresentationCoverage(): TerrainPresentationCoverage {
    const props = this.terrain.arePropsLoaded() ? "uploaded" : "stored";
    return {
      pages: Array.from(this.presentedPages, ([pageKey, presented]) => ({
        coverage: { fog: true, geometry: true, props },
        fingerprint: presented.page.fingerprint,
        pageKey,
        revision: presented.revision,
      })),
      revision: this.presentationRevision,
    };
  }

  clear(): void {
    this.cancelActiveRun?.();
    this.cancelActiveRun = null;
    this.presentationRevision += 1;
    this.terrain.present([]);
    this.presentedPages.clear();
    this.clearPreparedWork();
    this.visibleCellCount = 0;
  }

  dispose(): void {
    this.cancelActiveRun?.();
    this.cancelActiveRun = null;
    this.presentationRevision += 1;
    this.clearPreparedWork();
    this.presentedPages.clear();
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
    run.requiredPageKeys = preparations.map(({ request }) => request.pageKey);
    run.sourceReadyAtMs = performance.now();
    run.observer?.({
      kind: "source_ready",
      requestedPages: preparations.map(({ request }) => ({
        fingerprint: null,
        pageKey: request.pageKey,
      })),
      revision: run.revision,
      sourceReadyAtMs: run.sourceReadyAtMs,
    });
    const reuse = this.countPageReuse(preparations);
    const preparedPages =
      input.commitMode === "ambient"
        ? await this.commitAmbientPages(run, preparations)
        : await this.commitAtomicPages(run, preparations);
    await this.releaseObsoletePages(run, preparedPages);
    this.requireCurrent(run);
    const presentation = this.terrain.summarize(preparedPages);
    const diagnostics = {
      ...presentation,
      ...reuse,
      ...summarizePreparedPages(preparedPages),
      preparedCachePages: this.preparedBySignature.size,
      commitMs: run.commitMs,
      prepareMs: run.workerBuildMs ?? Number.NaN,
    };
    this.emitWindowComplete(run, reuse);
    return diagnostics;
  }

  /** Commits one independent page or one atomic replacement group after its own fog prerequisites are ready. */
  private async commitPreparedPages(
    run: PresentationRun,
    resolvedPages: readonly ResolvedTerrainPage[],
  ): Promise<void> {
    this.requireCurrent(run);
    const changedPages = resolvedPages.filter(({ page }) => !this.terrain.isPagePresented(page));
    if (changedPages.length === 0) {
      resolvedPages.forEach((resolved) => this.completePage(run, resolved, 0, 0));
      return;
    }
    const releasedPageKeys = this.resolveCapacityReleases(
      run,
      changedPages.map(({ page }) => page),
    );
    const nextPages = this.resolvePagesAfterCommit(
      changedPages.map(({ page }) => page),
      releasedPageKeys,
    );
    const fogMask = await this.terrain.prepareFogMaskAsync(nextPages);
    this.requireCurrent(run);
    const timing = await this.runTimedStep(run, "terrain:present:page", () =>
      this.terrain.commitPages(
        changedPages.map(({ page }) => page),
        releasedPageKeys,
        fogMask,
      ),
    );
    releasedPageKeys.forEach((pageKey) => this.presentedPages.delete(pageKey));
    changedPages.forEach(({ page, signature }) => {
      this.presentedPages.set(page.request.pageKey, {
        page,
        revision: run.revision,
        signature,
      });
    });
    this.refreshVisibleCellCount();
    const changedPageKeys = new Set(changedPages.map(({ page }) => page.request.pageKey));
    const commitCpuMs = timing.taskMs / changedPages.length;
    const queueWaitMs = timing.queueWaitMs / changedPages.length;
    resolvedPages.forEach((resolved) =>
      this.completePage(
        run,
        resolved,
        changedPageKeys.has(resolved.page.request.pageKey) ? commitCpuMs : 0,
        changedPageKeys.has(resolved.page.request.pageKey) ? queueWaitMs : 0,
      ),
    );
  }

  private beginPresentationRun(
    scheduler: FrameBudgetWorkScheduler | undefined,
    observer: TerrainPresentationObserver | undefined,
  ): PresentationRun {
    const requestedAtMs = performance.now();
    this.cancelActiveRun?.();
    this.presentationRevision += 1;
    let cancelRun = () => undefined;
    const cancelled = new Promise<never>((_resolve, reject) => {
      cancelRun = () => {
        reject(new SupersededPresentationError());
      };
    });
    this.cancelActiveRun = cancelRun;
    const run = {
      builtPages: 0,
      cancelled,
      completedPageKeys: new Set<string>(),
      commitMs: 0,
      observer,
      queueWaitMs: 0,
      requiredPageKeys: [],
      revision: this.presentationRevision,
      scheduler,
      sharedInFlightPages: 0,
      sourceReadyAtMs: null,
      taskMs: 0,
      workerBuildMs: 0,
    };
    observer?.({
      kind: "requested",
      requestedAtMs,
      revision: run.revision,
    });
    return run;
  }

  private runStep<T>(run: PresentationRun, step: TerrainPresentStep, work: () => T): Promise<T> {
    return this.runTimedStep(run, step, work).then(({ value }) => value);
  }

  private runTimedStep<T>(
    run: PresentationRun,
    step: TerrainPresentStep,
    work: () => T,
  ): Promise<{ queueWaitMs: number; taskMs: number; value: T }> {
    const queuedAt = performance.now();
    const scheduled = scheduleFrameBudgetWork(
      run.scheduler,
      "critical",
      () => {
        const queueWaitMs = performance.now() - queuedAt;
        const taskMsBefore = run.taskMs;
        const value = this.runCurrentStep(run, step, work);
        const taskMs = run.taskMs - taskMsBefore;
        if (step === "terrain:present:page" || step === "terrain:present:release") run.commitMs += taskMs;
        run.queueWaitMs = addMetricObservation(run.queueWaitMs, finiteMetric(queueWaitMs));
        return { queueWaitMs, taskMs, value };
      },
      step,
    );
    return Promise.race([scheduled, run.cancelled]);
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

  private resolveCapacityReleases(run: PresentationRun, changedPages: readonly PreparedTerrainPage[]): string[] {
    const addedPageKeys = new Set(
      changedPages.map(({ request }) => request.pageKey).filter((pageKey) => !this.presentedPages.has(pageKey)),
    );
    const overflow = this.presentedPages.size + addedPageKeys.size - TERRAIN_PROP_POOL_PAGE_SLOTS;
    if (overflow <= 0) return [];
    const obsoletePageKeys = Array.from(this.presentedPages.keys()).filter(
      (pageKey) => !run.requiredPageKeys.includes(pageKey),
    );
    if (obsoletePageKeys.length < overflow) {
      throw new Error(
        `Terrain presentation requires more than ${TERRAIN_PROP_POOL_PAGE_SLOTS} page slots for revision ${run.revision}`,
      );
    }
    return obsoletePageKeys.slice(0, overflow);
  }

  private resolvePagesAfterCommit(
    changedPages: readonly PreparedTerrainPage[],
    releasedPageKeys: readonly string[],
  ): PreparedTerrainPage[] {
    const pages = new Map(Array.from(this.presentedPages, ([pageKey, presented]) => [pageKey, presented.page]));
    releasedPageKeys.forEach((pageKey) => pages.delete(pageKey));
    changedPages.forEach((page) => pages.set(page.request.pageKey, page));
    return Array.from(pages.values());
  }

  private async releaseObsoletePages(
    run: PresentationRun,
    preparedPages: readonly PreparedTerrainPage[],
  ): Promise<void> {
    const requiredPageKeys = new Set(preparedPages.map(({ request }) => request.pageKey));
    const releasedPageKeys = Array.from(this.presentedPages.keys()).filter((pageKey) => !requiredPageKeys.has(pageKey));
    if (releasedPageKeys.length === 0) return;
    const fogMask = await this.terrain.prepareFogMaskAsync(preparedPages);
    this.requireCurrent(run);
    await this.runTimedStep(run, "terrain:present:release", () =>
      this.terrain.commitPages([], releasedPageKeys, fogMask),
    );
    releasedPageKeys.forEach((pageKey) => this.presentedPages.delete(pageKey));
    this.refreshVisibleCellCount();
  }

  private completePage(
    run: PresentationRun,
    resolved: ResolvedTerrainPage,
    commitCpuMs: number | null,
    queueWaitMs: number | null,
  ): void {
    this.requireCurrent(run);
    const pageKey = resolved.page.request.pageKey;
    if (run.completedPageKeys.has(pageKey)) return;
    const presented = this.presentedPages.get(pageKey);
    if (presented) presented.revision = run.revision;
    run.completedPageKeys.add(pageKey);
    if (resolved.source === "built") run.builtPages += 1;
    if (resolved.source === "shared_in_flight") run.sharedInFlightPages += 1;
    run.workerBuildMs = addMetricObservation(run.workerBuildMs, resolved.workerBuildMs);
    run.observer?.({
      commitCpuMs: finiteMetric(commitCpuMs),
      completedAtMs: performance.now(),
      completedPageKeys: this.completedPageKeys(run),
      coverage: {
        fog: true,
        geometry: true,
        props: this.terrain.arePropsLoaded() ? "uploaded" : "stored",
      },
      fingerprint: resolved.page.fingerprint,
      kind: "page_complete",
      pageKey,
      requiredPageKeys: [...run.requiredPageKeys],
      revision: run.revision,
      sourceReadyAtMs: this.requireSourceReadyAtMs(run),
      work: {
        queueWaitMs: finiteMetric(queueWaitMs),
        source: resolved.source,
        workerBuildMs: finiteMetric(resolved.workerBuildMs),
      },
    });
  }

  private emitWindowComplete(run: PresentationRun, reuse: TerrainPageReuse): void {
    this.requireCurrent(run);
    if (run.completedPageKeys.size !== run.requiredPageKeys.length) {
      throw new Error(`Terrain revision ${run.revision} converged without every required page completing`);
    }
    run.observer?.({
      completedAtMs: performance.now(),
      completedPageKeys: this.completedPageKeys(run),
      kind: "window_complete",
      requiredPageKeys: [...run.requiredPageKeys],
      revision: run.revision,
      work: {
        builtPages: run.builtPages,
        queueWaitMs: run.queueWaitMs,
        reusedPages: reuse.reusedPages,
        sharedInFlightPages: run.sharedInFlightPages,
        workerBuildMs: run.workerBuildMs,
      },
    });
  }

  private completedPageKeys(run: PresentationRun): string[] {
    return run.requiredPageKeys.filter((pageKey) => run.completedPageKeys.has(pageKey));
  }

  private requireSourceReadyAtMs(run: PresentationRun): number {
    if (run.sourceReadyAtMs === null) {
      throw new Error(`Terrain revision ${run.revision} completed a page before its source was ready`);
    }
    return run.sourceReadyAtMs;
  }

  private refreshVisibleCellCount(): void {
    this.visibleCellCount = Array.from(this.presentedPages.values()).reduce(
      (count, { page }) => count + page.request.cells.filter(({ explored }) => explored).length,
      0,
    );
  }

  private countPageReuse(preparations: readonly TerrainPagePreparation[]): TerrainPageReuse {
    const reusedPages = preparations.filter(
      ({ signature }) => this.preparedBySignature.has(signature) || this.pendingBySignature.has(signature),
    ).length;
    return { builtPages: preparations.length - reusedPages, reusedPages };
  }

  private async commitAmbientPages(
    run: PresentationRun,
    preparations: readonly TerrainPagePreparation[],
  ): Promise<PreparedTerrainPage[]> {
    const pages: PreparedTerrainPage[] = [];
    for (const preparation of preparations) {
      const resolved = await this.resolveCurrentPreparedPage(run, preparation);
      await this.commitPreparedPages(run, [resolved]);
      pages.push(resolved.page);
    }
    return pages;
  }

  private async commitAtomicPages(
    run: PresentationRun,
    preparations: readonly TerrainPagePreparation[],
  ): Promise<PreparedTerrainPage[]> {
    const resolved: ResolvedTerrainPage[] = [];
    for (const preparation of preparations) {
      resolved.push(await this.resolveCurrentPreparedPage(run, preparation));
    }
    await this.commitPreparedPages(run, resolved);
    return resolved.map(({ page }) => page);
  }

  private resolveCurrentPreparedPage(
    run: PresentationRun,
    preparation: TerrainPagePreparation,
  ): Promise<ResolvedTerrainPage> {
    this.requireCurrent(run);
    return Promise.race([this.resolvePreparedPage(preparation), run.cancelled]);
  }

  private resolvePreparedPage(preparation: TerrainPagePreparation): Promise<ResolvedTerrainPage> {
    const cached = this.preparedBySignature.get(preparation.signature);
    if (cached) {
      this.touchPreparedPage(preparation.signature, cached);
      return Promise.resolve({ page: cached, signature: preparation.signature, source: "cache", workerBuildMs: 0 });
    }
    const pending = this.pendingBySignature.get(preparation.signature);
    if (pending) {
      return pending.then((page) => ({
        page,
        signature: preparation.signature,
        source: "shared_in_flight",
        workerBuildMs: 0,
      }));
    }
    return this.preparePageAsync(preparation).then((page) => ({
      page,
      signature: preparation.signature,
      source: "built",
      workerBuildMs: finiteMetric(page.diagnostics.prepareMs),
    }));
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
    pages: Array.from(pagesByKey.values()).toSorted(
      (left, right) => left.startRow - right.startRow || left.startCol - right.startCol,
    ),
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
} {
  return {
    biomeMismatchCount: pages.reduce((count, page) => count + page.diagnostics.biomeMismatchCount, 0),
  };
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

function finiteMetric(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

function addMetricObservation(total: number | null, observation: number | null): number | null {
  if (total === null || observation === null) return null;
  return total + observation;
}
