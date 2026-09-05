export const TERRAIN_BENCHMARK_CONTRACT_VERSION = 2;

export const TERRAIN_BENCHMARK_VARIANTS = Object.freeze(["geometry", "material", "props", "production"] as const);
export const TERRAIN_BENCHMARK_EXPLORATION_MODES = Object.freeze(["explored", "frontier"] as const);
export type TerrainBenchmarkExplorationMode = (typeof TERRAIN_BENCHMARK_EXPLORATION_MODES)[number];
export type TerrainBenchmarkVariant = (typeof TERRAIN_BENCHMARK_VARIANTS)[number];
export type TerrainBenchmarkRunMode = "full" | "quick";
export type TerrainBenchmarkTraceMode = "performance" | "structural";
export type TerrainBenchmarkPhase = "idle" | "lifecycle" | "motion" | "static";

export interface TerrainBenchmarkFrameStats {
  above16Ms: number;
  above33Ms: number;
  above50Ms: number;
  fpsMedian: number;
  fpsOnePercentLow: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  sampleCount: number;
}

export interface TerrainBenchmarkVariantConfig {
  props: boolean;
  shadows: boolean;
  texturedGround: boolean;
}

export interface TerrainBenchmarkSnapshot {
  activeMode: "webgl2-fallback" | "webgpu";
  assets: {
    groundArrayRequests: number;
    propCatalogRequests: number;
  };
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
  contractVersion: 2;
  densityMultiplier: number;
  coverage: {
    checks: number;
    missingFrames: number;
    missingSamples: number;
    samples: number;
  };
  fixture: {
    cellCount: number;
    explorationMode: TerrainBenchmarkExplorationMode;
    fingerprint: string;
    pageCount: number;
    visiblePageCount: number;
  };
  frames: {
    motion: TerrainBenchmarkFrameStats;
    static: TerrainBenchmarkFrameStats;
  };
  lifecycle: {
    geometryGrowth: number;
    textureGrowth: number;
  };
  longTasks: {
    count: number;
    maxMs: number;
  };
  render: {
    drawCalls: number;
    firstTerrainFrameMs: number | null;
    geometries: number;
    pixelRatio: number;
    propInstances: number;
    shroudInstances: number;
    textures: number;
    triangles: number;
  };
  runMode: TerrainBenchmarkRunMode;
  status: "complete" | "error" | "ready" | "running";
  variant: TerrainBenchmarkVariant;
}

export function resolveTerrainBenchmarkVariant(variant: TerrainBenchmarkVariant): TerrainBenchmarkVariantConfig {
  switch (variant) {
    case "geometry":
      return { props: false, shadows: false, texturedGround: false };
    case "material":
      return { props: false, shadows: false, texturedGround: true };
    case "props":
      return { props: true, shadows: false, texturedGround: true };
    case "production":
      return { props: true, shadows: true, texturedGround: true };
  }
}

export function summarizeTerrainBenchmarkFrames(samples: readonly number[]): TerrainBenchmarkFrameStats {
  return {
    above16Ms: samples.filter((sample) => sample > 16.7).length,
    above33Ms: samples.filter((sample) => sample > 33.3).length,
    above50Ms: samples.filter((sample) => sample >= 50).length,
    fpsMedian: frameTimeToFps(percentile(samples, 0.5)),
    fpsOnePercentLow: frameTimeToFps(percentile(samples, 0.99)),
    maxMs: samples.length === 0 ? 0 : Math.max(...samples),
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    p99Ms: percentile(samples, 0.99),
    sampleCount: samples.length,
  };
}

export function percentile(samples: readonly number[], percentileValue: number): number {
  if (samples.length === 0) return 0;
  const sorted = samples.toSorted((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)];
}

function frameTimeToFps(frameTimeMs: number): number {
  return frameTimeMs <= 0 ? 0 : 1_000 / frameTimeMs;
}
