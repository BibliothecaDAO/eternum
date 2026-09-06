import type { RendererActiveMode } from "../renderer-backend-v2";
import type { TerrainPresentationCoverage, TerrainPresentationEvent } from "../terrain/worldmap-procedural-terrain";

const WORLDMAP_TERRAIN_PRESENTATION_METRICS_CONTRACT_VERSION = 2;

type WorldmapTerrainPropCoverage = "pending" | "stored" | "uploaded";
type WorldmapTerrainPageWorkAttribution = "built" | "cache" | "shared_in_flight";

interface WorldmapTerrainPageCoverage {
  fog: boolean;
  geometry: boolean;
  props: WorldmapTerrainPropCoverage;
}

interface WorldmapTerrainPageWork {
  attribution: WorldmapTerrainPageWorkAttribution;
  commitCpuMs: number | null;
  queueWaitMs: number | null;
  workerBuildMs: number | null;
}

interface WorldmapTerrainRequestedPage {
  fingerprint: string | null;
  pageKey: string;
}

interface WorldmapTerrainPresentationWorkSnapshot {
  builtPages: number;
  cachePages: number;
  commitCpuMs: number | null;
  queueWaitMs: number | null;
  sharedInFlightPages: number;
  workerBuildMs: number | null;
}

interface WorldmapTerrainPresentationTargetSnapshot {
  completePageKeys: string[];
  contractVersion: typeof WORLDMAP_TERRAIN_PRESENTATION_METRICS_CONTRACT_VERSION;
  converged: boolean;
  coverage: WorldmapTerrainPageCoverage;
  durations: {
    firstCompletePageMs: number | null;
    firstCompletePageRenderedMs: number | null;
    sourceReadyMs: number | null;
    windowConvergenceMs: number | null;
    windowFullyRenderedMs: number | null;
  };
  firstCompletePageAtMs: number | null;
  firstCompletePageRenderedAtMs: number | null;
  firstCompletePageRenderedBackend: RendererActiveMode | null;
  firstCompletePageRenderedCoverage: WorldmapTerrainPageCoverage | null;
  firstCompletePageRenderedRevision: number | null;
  pageFingerprints: Record<string, string | null>;
  requestedAtMs: number | null;
  requestedPageKeys: string[];
  revision: number;
  sceneId: string;
  sourceReadyAtMs: number | null;
  windowCompleteAtMs: number | null;
  windowFullyRenderedAtMs: number | null;
  windowFullyRenderedBackend: RendererActiveMode | null;
  windowFullyRenderedRevision: number | null;
  work: WorldmapTerrainPresentationWorkSnapshot;
}

export interface WorldmapTerrainPresentationMetricsSnapshot {
  contractVersion: typeof WORLDMAP_TERRAIN_PRESENTATION_METRICS_CONTRACT_VERSION;
  current: WorldmapTerrainPresentationTargetSnapshot | null;
}

interface WorldmapTerrainPageState {
  completedAtMs: number;
  coverage: WorldmapTerrainPageCoverage;
  fingerprint: string;
}

interface WorldmapTerrainPresentationTargetState {
  completePages: Map<string, WorldmapTerrainPageState>;
  firstCompletePageAtMs: number | null;
  firstCompletePageRenderedAtMs: number | null;
  firstCompletePageRenderedBackend: RendererActiveMode | null;
  firstCompletePageRenderedCoverage: WorldmapTerrainPageCoverage | null;
  firstCompletePageRenderedRevision: number | null;
  requestedAtMs: number | null;
  requestedPages: Map<string, string | null>;
  revision: number;
  sceneId: string;
  sourceReadyAtMs: number | null;
  windowCompleteAtMs: number | null;
  windowFullyRenderedAtMs: number | null;
  windowFullyRenderedBackend: RendererActiveMode | null;
  windowFullyRenderedRevision: number | null;
  work: WorldmapTerrainPresentationWorkSnapshot;
}

interface WorldmapTerrainPresentationMetrics {
  disposeScene(sceneId: string): void;
  readonly state: {
    current: WorldmapTerrainPresentationTargetState | null;
  };
}

const activeWorldmapTerrainPresentationMetrics = createWorldmapTerrainPresentationMetrics();

interface RecordWorldmapTerrainPresentationRequestInput {
  requestedAtMs: number;
  revision: number;
  sceneId: string;
}

interface RecordWorldmapTerrainSourceReadyInput {
  atMs: number;
  requestedPages: readonly WorldmapTerrainRequestedPage[];
  revision: number;
  sceneId: string;
}

interface RecordWorldmapTerrainPageCompletionInput {
  completedAtMs: number;
  coverage: WorldmapTerrainPageCoverage;
  fingerprint: string;
  pageKey: string;
  revision: number;
  sceneId: string;
  work: WorldmapTerrainPageWork;
}

interface RecordWorldmapTerrainWindowCompletionInput {
  completedAtMs: number;
  revision: number;
  sceneId: string;
  work?: {
    builtPages: number;
    queueWaitMs: number | null;
    reusedPages: number;
    sharedInFlightPages: number;
    workerBuildMs: number | null;
  };
}

interface RecordWorldmapTerrainRenderedFrameInput {
  atMs: number;
  backend: RendererActiveMode;
  detailedTerrainVisible: boolean;
  rendered?: boolean;
  sceneId: string;
}

interface RecordWorldmapTerrainPropsUploadedInput {
  atMs: number;
  pages: readonly WorldmapTerrainRequestedPage[];
  revision: number;
  sceneId: string;
}

export function createWorldmapTerrainPresentationMetrics(): WorldmapTerrainPresentationMetrics {
  const state: WorldmapTerrainPresentationMetrics["state"] = { current: null };
  return {
    disposeScene(sceneId) {
      if (state.current?.sceneId === sceneId) state.current = null;
    },
    state,
  };
}

export function recordWorldmapTerrainPresentationRequest(
  metrics: WorldmapTerrainPresentationMetrics,
  input: RecordWorldmapTerrainPresentationRequestInput,
): void {
  metrics.state.current = {
    completePages: new Map(),
    firstCompletePageAtMs: null,
    firstCompletePageRenderedAtMs: null,
    firstCompletePageRenderedBackend: null,
    firstCompletePageRenderedCoverage: null,
    firstCompletePageRenderedRevision: null,
    requestedAtMs: finiteOrNull(input.requestedAtMs),
    requestedPages: new Map(),
    revision: input.revision,
    sceneId: input.sceneId,
    sourceReadyAtMs: null,
    windowCompleteAtMs: null,
    windowFullyRenderedAtMs: null,
    windowFullyRenderedBackend: null,
    windowFullyRenderedRevision: null,
    work: createEmptyWorkSnapshot(),
  };
}

export function recordWorldmapTerrainSourceReady(
  metrics: WorldmapTerrainPresentationMetrics,
  input: RecordWorldmapTerrainSourceReadyInput,
): { accepted: boolean; sourceReadyDurationMs: number | null } {
  const target = resolveCurrentTarget(metrics, input);
  if (!target || target.sourceReadyAtMs !== null || !Number.isFinite(input.atMs)) {
    return { accepted: false, sourceReadyDurationMs: null };
  }

  target.sourceReadyAtMs = input.atMs;
  target.requestedPages = new Map(input.requestedPages.map(({ fingerprint, pageKey }) => [pageKey, fingerprint]));
  return { accepted: true, sourceReadyDurationMs: durationBetween(target.requestedAtMs, input.atMs) };
}

export function recordWorldmapTerrainPageCompletion(
  metrics: WorldmapTerrainPresentationMetrics,
  input: RecordWorldmapTerrainPageCompletionInput,
): { accepted: boolean; firstCompletePageDurationMs: number | null; firstPageCompleted: boolean } {
  const target = resolveCurrentTarget(metrics, input);
  if (!target || !isCompleteCoverage(input.coverage) || !Number.isFinite(input.completedAtMs)) {
    return { accepted: false, firstCompletePageDurationMs: null, firstPageCompleted: false };
  }

  const requestedFingerprint = target.requestedPages.get(input.pageKey);
  if (
    requestedFingerprint === undefined ||
    (requestedFingerprint !== null && requestedFingerprint !== input.fingerprint)
  ) {
    return { accepted: false, firstCompletePageDurationMs: null, firstPageCompleted: false };
  }
  if (target.completePages.has(input.pageKey)) {
    return { accepted: false, firstCompletePageDurationMs: null, firstPageCompleted: false };
  }

  target.completePages.set(input.pageKey, {
    completedAtMs: input.completedAtMs,
    coverage: { ...input.coverage },
    fingerprint: input.fingerprint,
  });
  const firstPageCompleted = target.firstCompletePageAtMs === null;
  target.firstCompletePageAtMs ??= input.completedAtMs;
  accumulatePageWork(target.work, input.work);
  return {
    accepted: true,
    firstCompletePageDurationMs: firstPageCompleted ? durationBetween(target.requestedAtMs, input.completedAtMs) : null,
    firstPageCompleted,
  };
}

export function recordWorldmapTerrainWindowCompletion(
  metrics: WorldmapTerrainPresentationMetrics,
  input: RecordWorldmapTerrainWindowCompletionInput,
): { accepted: boolean; windowConverged: boolean; windowConvergenceDurationMs: number | null } {
  const target = resolveCurrentTarget(metrics, input);
  if (
    !target ||
    !Number.isFinite(input.completedAtMs) ||
    target.requestedPages.size === 0 ||
    target.completePages.size !== target.requestedPages.size
  ) {
    return { accepted: false, windowConverged: false, windowConvergenceDurationMs: null };
  }
  if (target.windowCompleteAtMs !== null) {
    return { accepted: false, windowConverged: false, windowConvergenceDurationMs: null };
  }

  target.windowCompleteAtMs = input.completedAtMs;
  if (input.work) target.work = summarizeWindowWork(input.work, target.work.commitCpuMs);
  return {
    accepted: true,
    windowConverged: true,
    windowConvergenceDurationMs: durationBetween(target.requestedAtMs, input.completedAtMs),
  };
}

export function recordWorldmapTerrainRenderedFrame(
  metrics: WorldmapTerrainPresentationMetrics,
  input: RecordWorldmapTerrainRenderedFrameInput,
): {
  firstCompletePageRenderedDurationMs: number | null;
  firstCompletePageRendered: boolean;
  revision: number | null;
  windowFullyRenderedDurationMs: number | null;
  windowFullyRendered: boolean;
} {
  const target = metrics.state.current;
  if (
    input.rendered === false ||
    !input.detailedTerrainVisible ||
    !target ||
    target.sceneId !== input.sceneId ||
    target.completePages.size === 0 ||
    !Number.isFinite(input.atMs)
  ) {
    return {
      firstCompletePageRenderedDurationMs: null,
      firstCompletePageRendered: false,
      revision: target?.revision ?? null,
      windowFullyRenderedDurationMs: null,
      windowFullyRendered: false,
    };
  }

  const firstCompletePageRendered = target.firstCompletePageRenderedAtMs === null;
  if (firstCompletePageRendered) {
    target.firstCompletePageRenderedAtMs = input.atMs;
    target.firstCompletePageRenderedBackend = input.backend;
    target.firstCompletePageRenderedCoverage = summarizeCompletedPageCoverage(target);
    target.firstCompletePageRenderedRevision = target.revision;
  }

  const coverage = summarizeCoverage(target, Array.from(target.requestedPages.keys()));
  const windowFullyRendered =
    target.windowFullyRenderedAtMs === null && target.windowCompleteAtMs !== null && coverage.props === "uploaded";
  if (windowFullyRendered) {
    target.windowFullyRenderedAtMs = input.atMs;
    target.windowFullyRenderedBackend = input.backend;
    target.windowFullyRenderedRevision = target.revision;
  }

  return {
    firstCompletePageRenderedDurationMs: firstCompletePageRendered
      ? durationBetween(target.requestedAtMs, input.atMs)
      : null,
    firstCompletePageRendered,
    revision: target.revision,
    windowFullyRenderedDurationMs: windowFullyRendered ? durationBetween(target.requestedAtMs, input.atMs) : null,
    windowFullyRendered,
  };
}

export function recordWorldmapTerrainPropsUploaded(
  metrics: WorldmapTerrainPresentationMetrics,
  input: RecordWorldmapTerrainPropsUploadedInput,
): { acceptedPages: number } {
  const target = resolveCurrentTarget(metrics, input);
  if (!target || !Number.isFinite(input.atMs)) return { acceptedPages: 0 };

  let acceptedPages = 0;
  input.pages.forEach(({ fingerprint, pageKey }) => {
    const page = target.completePages.get(pageKey);
    if (!page || fingerprint === null || page.fingerprint !== fingerprint || page.coverage.props === "uploaded") return;
    page.coverage.props = "uploaded";
    acceptedPages += 1;
  });
  return { acceptedPages };
}

export function snapshotWorldmapTerrainPresentationMetrics(
  metrics: WorldmapTerrainPresentationMetrics,
): WorldmapTerrainPresentationMetricsSnapshot {
  return {
    contractVersion: WORLDMAP_TERRAIN_PRESENTATION_METRICS_CONTRACT_VERSION,
    current: metrics.state.current ? snapshotTarget(metrics.state.current) : null,
  };
}

export function getActiveWorldmapTerrainPresentationMetrics(): WorldmapTerrainPresentationMetrics {
  return activeWorldmapTerrainPresentationMetrics;
}

export function snapshotActiveWorldmapTerrainPresentationMetrics(): WorldmapTerrainPresentationMetricsSnapshot {
  return snapshotWorldmapTerrainPresentationMetrics(activeWorldmapTerrainPresentationMetrics);
}

export function resetActiveWorldmapTerrainPresentationMetrics(): void {
  activeWorldmapTerrainPresentationMetrics.state.current = null;
}

export function recordWorldmapTerrainPresentationEvent(
  metrics: WorldmapTerrainPresentationMetrics,
  sceneId: string,
  event: TerrainPresentationEvent,
):
  | { kind: "none" }
  | { durationMs: number | null; kind: "source_ready" }
  | { durationMs: number | null; kind: "first_complete_page" }
  | { durationMs: number | null; kind: "window_convergence" } {
  switch (event.kind) {
    case "requested":
      recordWorldmapTerrainPresentationRequest(metrics, { ...event, sceneId });
      return { kind: "none" };
    case "source_ready": {
      const result = recordWorldmapTerrainSourceReady(metrics, {
        atMs: event.sourceReadyAtMs,
        requestedPages: event.requestedPages,
        revision: event.revision,
        sceneId,
      });
      return result.accepted ? { durationMs: result.sourceReadyDurationMs, kind: "source_ready" } : { kind: "none" };
    }
    case "page_complete": {
      const result = recordWorldmapTerrainPageCompletion(metrics, {
        completedAtMs: event.completedAtMs,
        coverage: event.coverage,
        fingerprint: event.fingerprint,
        pageKey: event.pageKey,
        revision: event.revision,
        sceneId,
        work: {
          attribution: event.work.source,
          commitCpuMs: event.commitCpuMs,
          queueWaitMs: event.work.queueWaitMs,
          workerBuildMs: event.work.workerBuildMs,
        },
      });
      return result.firstPageCompleted
        ? { durationMs: result.firstCompletePageDurationMs, kind: "first_complete_page" }
        : { kind: "none" };
    }
    case "window_complete": {
      const result = recordWorldmapTerrainWindowCompletion(metrics, {
        completedAtMs: event.completedAtMs,
        revision: event.revision,
        sceneId,
        work: event.work,
      });
      return result.windowConverged
        ? { durationMs: result.windowConvergenceDurationMs, kind: "window_convergence" }
        : { kind: "none" };
    }
  }
}

export function syncWorldmapTerrainPresentationCoverage(
  metrics: WorldmapTerrainPresentationMetrics,
  sceneId: string,
  coverage: TerrainPresentationCoverage,
  atMs: number,
): void {
  recordWorldmapTerrainPropsUploaded(metrics, {
    atMs,
    pages: coverage.pages
      .filter((page) => page.coverage.props === "uploaded")
      .map(({ fingerprint, pageKey }) => ({ fingerprint, pageKey })),
    revision: coverage.revision,
    sceneId,
  });
}

function resolveCurrentTarget(
  metrics: WorldmapTerrainPresentationMetrics,
  input: Pick<RecordWorldmapTerrainPageCompletionInput, "revision" | "sceneId">,
): WorldmapTerrainPresentationTargetState | null {
  const target = metrics.state.current;
  if (!target || target.sceneId !== input.sceneId || target.revision !== input.revision) return null;
  return target;
}

function isCompleteCoverage(coverage: WorldmapTerrainPageCoverage): boolean {
  return coverage.geometry && coverage.fog && coverage.props !== "pending";
}

function createEmptyWorkSnapshot(): WorldmapTerrainPresentationWorkSnapshot {
  return {
    builtPages: 0,
    cachePages: 0,
    commitCpuMs: 0,
    queueWaitMs: 0,
    sharedInFlightPages: 0,
    workerBuildMs: 0,
  };
}

function accumulatePageWork(aggregate: WorldmapTerrainPresentationWorkSnapshot, work: WorldmapTerrainPageWork): void {
  if (work.attribution === "built") aggregate.builtPages += 1;
  if (work.attribution === "cache") aggregate.cachePages += 1;
  if (work.attribution === "shared_in_flight") aggregate.sharedInFlightPages += 1;
  aggregate.commitCpuMs = addFiniteObservation(aggregate.commitCpuMs, work.commitCpuMs);
  aggregate.queueWaitMs = addFiniteObservation(aggregate.queueWaitMs, work.queueWaitMs);
  aggregate.workerBuildMs = addFiniteObservation(aggregate.workerBuildMs, work.workerBuildMs);
}

function summarizeWindowWork(
  work: NonNullable<RecordWorldmapTerrainWindowCompletionInput["work"]>,
  commitCpuMs: number | null,
): WorldmapTerrainPresentationWorkSnapshot {
  return {
    builtPages: work.builtPages,
    cachePages: Math.max(0, work.reusedPages - work.sharedInFlightPages),
    commitCpuMs,
    queueWaitMs: finiteOrNull(work.queueWaitMs),
    sharedInFlightPages: work.sharedInFlightPages,
    workerBuildMs: finiteOrNull(work.workerBuildMs),
  };
}

function addFiniteObservation(total: number | null, observation: number | null): number | null {
  if (total === null || observation === null || !Number.isFinite(observation) || observation < 0) return null;
  return total + observation;
}

function snapshotTarget(target: WorldmapTerrainPresentationTargetState): WorldmapTerrainPresentationTargetSnapshot {
  const requestedPageKeys = Array.from(target.requestedPages.keys());
  const completePageKeys = requestedPageKeys.filter((pageKey) => target.completePages.has(pageKey));
  const pageFingerprints = Object.fromEntries(
    requestedPageKeys.map((pageKey) => [
      pageKey,
      target.completePages.get(pageKey)?.fingerprint ?? target.requestedPages.get(pageKey) ?? null,
    ]),
  );
  return {
    completePageKeys,
    contractVersion: WORLDMAP_TERRAIN_PRESENTATION_METRICS_CONTRACT_VERSION,
    converged: target.windowCompleteAtMs !== null,
    coverage: summarizeCoverage(target, requestedPageKeys),
    durations: {
      firstCompletePageMs: durationBetween(target.requestedAtMs, target.firstCompletePageAtMs),
      firstCompletePageRenderedMs: durationBetween(target.requestedAtMs, target.firstCompletePageRenderedAtMs),
      sourceReadyMs: durationBetween(target.requestedAtMs, target.sourceReadyAtMs),
      windowConvergenceMs: durationBetween(target.requestedAtMs, target.windowCompleteAtMs),
      windowFullyRenderedMs: durationBetween(target.requestedAtMs, target.windowFullyRenderedAtMs),
    },
    firstCompletePageAtMs: target.firstCompletePageAtMs,
    firstCompletePageRenderedAtMs: target.firstCompletePageRenderedAtMs,
    firstCompletePageRenderedBackend: target.firstCompletePageRenderedBackend,
    firstCompletePageRenderedCoverage: target.firstCompletePageRenderedCoverage
      ? { ...target.firstCompletePageRenderedCoverage }
      : null,
    firstCompletePageRenderedRevision: target.firstCompletePageRenderedRevision,
    pageFingerprints,
    requestedAtMs: target.requestedAtMs,
    requestedPageKeys,
    revision: target.revision,
    sceneId: target.sceneId,
    sourceReadyAtMs: target.sourceReadyAtMs,
    windowCompleteAtMs: target.windowCompleteAtMs,
    windowFullyRenderedAtMs: target.windowFullyRenderedAtMs,
    windowFullyRenderedBackend: target.windowFullyRenderedBackend,
    windowFullyRenderedRevision: target.windowFullyRenderedRevision,
    work: snapshotWork(target),
  };
}

function snapshotWork(target: WorldmapTerrainPresentationTargetState): WorldmapTerrainPresentationWorkSnapshot {
  if (target.completePages.size > 0) return { ...target.work };
  return {
    ...target.work,
    commitCpuMs: null,
    queueWaitMs: null,
    workerBuildMs: null,
  };
}

function summarizeCompletedPageCoverage(target: WorldmapTerrainPresentationTargetState): WorldmapTerrainPageCoverage {
  const pages = Array.from(target.completePages.values());
  return {
    fog: pages.every((page) => page.coverage.fog),
    geometry: pages.every((page) => page.coverage.geometry),
    props: pages.every((page) => page.coverage.props === "uploaded") ? "uploaded" : "stored",
  };
}

function summarizeCoverage(
  target: WorldmapTerrainPresentationTargetState,
  requestedPageKeys: readonly string[],
): WorldmapTerrainPageCoverage {
  const pages = requestedPageKeys.map((pageKey) => target.completePages.get(pageKey));
  const allComplete = pages.length > 0 && pages.every(Boolean);
  return {
    fog: allComplete && pages.every((page) => page?.coverage.fog),
    geometry: allComplete && pages.every((page) => page?.coverage.geometry),
    props: !allComplete
      ? "pending"
      : pages.every((page) => page?.coverage.props === "uploaded")
        ? "uploaded"
        : "stored",
  };
}

function finiteOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

function durationBetween(startedAtMs: number | null, completedAtMs: number | null): number | null {
  if (startedAtMs === null || completedAtMs === null || completedAtMs < startedAtMs) return null;
  return completedAtMs - startedAtMs;
}
