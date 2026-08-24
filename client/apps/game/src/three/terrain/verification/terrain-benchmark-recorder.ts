import {
  percentile,
  summarizeTerrainBenchmarkFrames,
  type TerrainBenchmarkFrameStats,
  type TerrainBenchmarkPhase,
} from "./terrain-benchmark-contract";

export interface TerrainBenchmarkRecorderSnapshot {
  chunks: {
    builtPages: number;
    commitMaxMs: number;
    commitP95Ms: number;
    committedWindows: number;
    lifecyclePagesVisited: number;
    prepareMaxMs: number;
    prepareP95Ms: number;
    requestedWindows: number;
    reusedPages: number;
    staleWindows: number;
  };
  coverage: {
    checks: number;
    missingFrames: number;
    missingSamples: number;
    samples: number;
  };
  frames: {
    motion: TerrainBenchmarkFrameStats;
    static: TerrainBenchmarkFrameStats;
  };
  longTasks: {
    count: number;
    maxMs: number;
  };
}

export class TerrainBenchmarkRecorder {
  private readonly frameSamples = { motion: [] as number[], static: [] as number[] };
  private readonly prepareSamples: number[] = [];
  private readonly commitSamples: number[] = [];
  private phase: TerrainBenchmarkPhase = "idle";
  private previousFrameTime: number | null = null;
  private requestedWindows = 0;
  private committedWindows = 0;
  private staleWindows = 0;
  private builtPages = 0;
  private reusedPages = 0;
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

  recordWindowRequest(): void {
    this.requestedWindows += 1;
  }

  recordWindowCommit(input: { builtPages: number; commitMs: number; prepareMs: number; reusedPages: number }): void {
    this.committedWindows += 1;
    this.builtPages += input.builtPages;
    this.reusedPages += input.reusedPages;
    this.prepareSamples.push(input.prepareMs);
    this.commitSamples.push(input.commitMs);
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
    if (this.phase === "idle") return;
    if (Number.isFinite(durationMs) && durationMs > 0) this.longTasks.push(durationMs);
  }

  snapshot(): TerrainBenchmarkRecorderSnapshot {
    return {
      chunks: {
        builtPages: this.builtPages,
        commitMaxMs: maximum(this.commitSamples),
        commitP95Ms: percentile(this.commitSamples, 0.95),
        committedWindows: this.committedWindows,
        lifecyclePagesVisited: this.lifecyclePagesVisited,
        prepareMaxMs: maximum(this.prepareSamples),
        prepareP95Ms: percentile(this.prepareSamples, 0.95),
        requestedWindows: this.requestedWindows,
        reusedPages: this.reusedPages,
        staleWindows: this.staleWindows,
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
      longTasks: {
        count: this.longTasks.length,
        maxMs: maximum(this.longTasks),
      },
    };
  }
}

function maximum(samples: readonly number[]): number {
  return samples.length === 0 ? 0 : Math.max(...samples);
}
