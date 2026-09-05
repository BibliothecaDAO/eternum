import type { TerrainPresentationEvent } from "../worldmap-procedural-terrain";
import {
  percentile,
  summarizeTerrainBenchmarkFrames,
  type TerrainBenchmarkFrameStats,
  type TerrainBenchmarkPhase,
} from "./terrain-benchmark-contract";

export interface TerrainBenchmarkRecorderSnapshot {
  chunks: {
    builtPages: number;
    cachePages: number;
    commitMaxMs: number;
    commitP95Ms: number;
    commitSamples: number;
    convergedWindows: number;
    firstCompletePageMaxMs: number;
    firstCompletePageP95Ms: number;
    firstCompletePageSamples: number;
    firstRenderedFrameMaxMs: number;
    firstRenderedFrameP95Ms: number;
    firstRenderedFrameSamples: number;
    lifecyclePagesVisited: number;
    queueWaitMaxMs: number;
    queueWaitP95Ms: number;
    queueWaitSamples: number;
    requestedWindows: number;
    reusedPages: number;
    sharedInFlightPages: number;
    staleWindows: number;
    windowConvergenceMaxMs: number;
    windowConvergenceP95Ms: number;
    windowConvergenceSamples: number;
    workerBuildMaxMs: number;
    workerBuildP95Ms: number;
    workerBuildSamples: number;
  };
  coverage: { checks: number; missingFrames: number; missingSamples: number; samples: number };
  frames: { motion: TerrainBenchmarkFrameStats; static: TerrainBenchmarkFrameStats };
  longTasks: { count: number; maxMs: number };
}

interface PresentationTiming {
  firstPageComplete: boolean;
  rendered: boolean;
  requestedAtMs: number | null;
  windowComplete: boolean;
}

export class TerrainBenchmarkRecorder {
  private readonly frameSamples = { motion: [] as number[], static: [] as number[] };
  private readonly commitSamples: number[] = [];
  private readonly firstCompletePageSamples: number[] = [];
  private readonly firstRenderedFrameSamples: number[] = [];
  private readonly queueWaitSamples: number[] = [];
  private readonly windowConvergenceSamples: number[] = [];
  private readonly workerBuildSamples: number[] = [];
  private readonly presentations = new Map<number, PresentationTiming>();
  private phase: TerrainBenchmarkPhase = "idle";
  private previousFrameTime: number | null = null;
  private requestedWindows = 0;
  private convergedWindows = 0;
  private staleWindows = 0;
  private builtPages = 0;
  private reusedPages = 0;
  private sharedInFlightPages = 0;
  private lifecyclePagesVisited = 0;
  private coverageChecks = 0;
  private coverageSamples = 0;
  private missingCoverageSamples = 0;
  private missingCoverageFrames = 0;
  private readonly longTasks: number[] = [];

  setPhase(phase: TerrainBenchmarkPhase): void {
    this.phase = phase;
    this.previousFrameTime = null;
  }

  recordFrame(time: number): void {
    if (this.previousFrameTime !== null && (this.phase === "static" || this.phase === "motion")) {
      this.frameSamples[this.phase].push(time - this.previousFrameTime);
    }
    this.previousFrameTime = time;
  }

  recordTerrainEvent(event: TerrainPresentationEvent): void {
    switch (event.kind) {
      case "requested":
        this.requestedWindows += 1;
        this.presentations.set(event.revision, {
          firstPageComplete: false,
          rendered: false,
          requestedAtMs: finiteMetric(event.requestedAtMs),
          windowComplete: false,
        });
        break;
      case "source_ready":
        break;
      case "page_complete":
        this.recordPageCompletion(event);
        break;
      case "window_complete":
        this.recordWindowConvergence(event);
        break;
    }
  }

  recordRenderedFrame(atMs: number): number | null {
    const pending = Array.from(this.presentations.values()).findLast(
      (timing) => timing.windowComplete && !timing.rendered,
    );
    if (!pending) return null;
    const durationMs = durationBetween(pending.requestedAtMs, atMs);
    if (durationMs === null) return null;
    pending.rendered = true;
    this.firstRenderedFrameSamples.push(durationMs);
    return durationMs;
  }

  getFirstRenderedFrameMs(): number | null {
    return this.firstRenderedFrameSamples[0] ?? null;
  }

  recordStaleWindow(): void {
    this.staleWindows += 1;
  }

  recordLifecyclePageVisit(): void {
    this.lifecyclePagesVisited += 1;
  }

  recordCoverage(sampleCount: number, missingSampleCount: number): void {
    this.coverageChecks += 1;
    this.coverageSamples += sampleCount;
    this.missingCoverageSamples += missingSampleCount;
    if (missingSampleCount > 0) this.missingCoverageFrames += 1;
  }

  recordLongTask(durationMs: number): void {
    if (this.phase !== "idle" && Number.isFinite(durationMs) && durationMs > 0) this.longTasks.push(durationMs);
  }

  snapshot(): TerrainBenchmarkRecorderSnapshot {
    return {
      chunks: {
        builtPages: this.builtPages,
        cachePages: this.reusedPages - this.sharedInFlightPages,
        commitMaxMs: maximum(this.commitSamples),
        commitP95Ms: percentile(this.commitSamples, 0.95),
        commitSamples: this.commitSamples.length,
        convergedWindows: this.convergedWindows,
        firstCompletePageMaxMs: maximum(this.firstCompletePageSamples),
        firstCompletePageP95Ms: percentile(this.firstCompletePageSamples, 0.95),
        firstCompletePageSamples: this.firstCompletePageSamples.length,
        firstRenderedFrameMaxMs: maximum(this.firstRenderedFrameSamples),
        firstRenderedFrameP95Ms: percentile(this.firstRenderedFrameSamples, 0.95),
        firstRenderedFrameSamples: this.firstRenderedFrameSamples.length,
        lifecyclePagesVisited: this.lifecyclePagesVisited,
        queueWaitMaxMs: maximum(this.queueWaitSamples),
        queueWaitP95Ms: percentile(this.queueWaitSamples, 0.95),
        queueWaitSamples: this.queueWaitSamples.length,
        requestedWindows: this.requestedWindows,
        reusedPages: this.reusedPages,
        sharedInFlightPages: this.sharedInFlightPages,
        staleWindows: this.staleWindows,
        windowConvergenceMaxMs: maximum(this.windowConvergenceSamples),
        windowConvergenceP95Ms: percentile(this.windowConvergenceSamples, 0.95),
        windowConvergenceSamples: this.windowConvergenceSamples.length,
        workerBuildMaxMs: maximum(this.workerBuildSamples),
        workerBuildP95Ms: percentile(this.workerBuildSamples, 0.95),
        workerBuildSamples: this.workerBuildSamples.length,
      },
      coverage: {
        checks: this.coverageChecks,
        missingFrames: this.missingCoverageFrames,
        missingSamples: this.missingCoverageSamples,
        samples: this.coverageSamples,
      },
      frames: {
        motion: summarizeTerrainBenchmarkFrames(this.frameSamples.motion),
        static: summarizeTerrainBenchmarkFrames(this.frameSamples.static),
      },
      longTasks: { count: this.longTasks.length, maxMs: maximum(this.longTasks) },
    };
  }

  private recordPageCompletion(event: Extract<TerrainPresentationEvent, { kind: "page_complete" }>): void {
    const timing = this.presentations.get(event.revision);
    if (!timing) return;
    pushFinite(this.commitSamples, event.commitCpuMs);
    if (timing.firstPageComplete) return;
    timing.firstPageComplete = true;
    pushFinite(this.firstCompletePageSamples, durationBetween(timing.requestedAtMs, event.completedAtMs));
  }

  private recordWindowConvergence(event: Extract<TerrainPresentationEvent, { kind: "window_complete" }>): void {
    const timing = this.presentations.get(event.revision);
    if (!timing || timing.windowComplete) return;
    timing.windowComplete = true;
    this.convergedWindows += 1;
    this.builtPages += event.work.builtPages;
    this.reusedPages += event.work.reusedPages;
    this.sharedInFlightPages += event.work.sharedInFlightPages;
    pushFinite(this.queueWaitSamples, event.work.queueWaitMs);
    pushFinite(this.workerBuildSamples, event.work.workerBuildMs);
    pushFinite(this.windowConvergenceSamples, durationBetween(timing.requestedAtMs, event.completedAtMs));
  }
}

function finiteMetric(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

function durationBetween(startedAtMs: number | null, completedAtMs: number): number | null {
  return startedAtMs !== null && Number.isFinite(completedAtMs) && completedAtMs >= startedAtMs
    ? completedAtMs - startedAtMs
    : null;
}

function pushFinite(samples: number[], value: number | null): void {
  const finite = finiteMetric(value);
  if (finite !== null) samples.push(finite);
}

function maximum(samples: readonly number[]): number {
  return samples.length === 0 ? 0 : Math.max(...samples);
}
