import {
  WORLDMAP_CHUNK_DIAGNOSTICS_CONTRACT_VERSION,
  type WorldmapChunkDiagnostics,
} from "./worldmap-chunk-diagnostics";

export type ChunkSwitchP95RegressionMetric =
  | "switch_duration"
  | "terrain_first_complete_page"
  | "terrain_window_convergence"
  | "terrain_first_rendered_frame";

interface EvaluateChunkSwitchP95RegressionInput {
  baseline: WorldmapChunkDiagnostics;
  current: WorldmapChunkDiagnostics;
  allowedRegressionFraction?: number;
  metric?: ChunkSwitchP95RegressionMetric;
  minimumSamples?: number;
}

interface ChunkSwitchP95RegressionBaseResult {
  metric: ChunkSwitchP95RegressionMetric;
  baselineP95Ms: number | null;
  currentP95Ms: number | null;
  allowedRegressionFraction: number;
  regressionFraction: number | null;
}

interface ChunkSwitchP95RegressionPassResult extends ChunkSwitchP95RegressionBaseResult {
  status: "pass";
}

interface ChunkSwitchP95RegressionFailResult extends ChunkSwitchP95RegressionBaseResult {
  status: "fail";
  reason: string;
}

interface ChunkSwitchP95RegressionPendingResult extends ChunkSwitchP95RegressionBaseResult {
  status: "pending";
  reason: string;
}

export type ChunkSwitchP95RegressionResult =
  | ChunkSwitchP95RegressionPassResult
  | ChunkSwitchP95RegressionFailResult
  | ChunkSwitchP95RegressionPendingResult;

function toSortedFiniteSamples(samples: number[]): number[] {
  return samples.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
}

function getNearestRankPercentile(sortedValues: number[], percentile: number): number | null {
  if (sortedValues.length === 0) {
    return null;
  }

  const clampedPercentile = Math.max(0, Math.min(1, percentile));
  const rank = Math.max(1, Math.ceil(clampedPercentile * sortedValues.length));
  return sortedValues[rank - 1] ?? sortedValues[sortedValues.length - 1] ?? null;
}

function getP95(samples: number[]): number | null {
  return getNearestRankPercentile(toSortedFiniteSamples(samples), 0.95);
}

function resolveRegressionSamples(
  diagnostics: WorldmapChunkDiagnostics,
  metric: ChunkSwitchP95RegressionMetric,
): number[] {
  switch (metric) {
    case "terrain_first_complete_page":
      return diagnostics.terrainFirstCompletePageDurationMsSamples;
    case "terrain_window_convergence":
      return diagnostics.terrainWindowConvergenceDurationMsSamples;
    case "terrain_first_rendered_frame":
      return diagnostics.terrainFirstRenderedFrameDurationMsSamples;
    case "switch_duration":
    default:
      return diagnostics.switchDurationMsSamples;
  }
}

function getMetricLabel(metric: ChunkSwitchP95RegressionMetric): string {
  switch (metric) {
    case "terrain_first_complete_page":
      return "terrain-first-complete-page";
    case "terrain_window_convergence":
      return "terrain-window-convergence";
    case "terrain_first_rendered_frame":
      return "terrain-first-rendered-frame";
    case "switch_duration":
      return "chunk-switch";
  }
}

export function evaluateChunkSwitchP95Regression(
  input: EvaluateChunkSwitchP95RegressionInput,
): ChunkSwitchP95RegressionResult {
  const metric = input.metric ?? "switch_duration";
  const minimumSamples = Math.max(1, Math.floor(input.minimumSamples ?? 1));
  const allowedRegressionFraction = Math.max(0, input.allowedRegressionFraction ?? 0.1);
  const baselineSamples = toSortedFiniteSamples(resolveRegressionSamples(input.baseline, metric));
  const currentSamples = toSortedFiniteSamples(resolveRegressionSamples(input.current, metric));
  const baselineP95Ms = getP95(baselineSamples);
  const currentP95Ms = getP95(currentSamples);
  const metricLabel = getMetricLabel(metric);

  if (
    input.baseline.contractVersion !== WORLDMAP_CHUNK_DIAGNOSTICS_CONTRACT_VERSION ||
    input.current.contractVersion !== WORLDMAP_CHUNK_DIAGNOSTICS_CONTRACT_VERSION
  ) {
    return {
      status: "pending",
      reason: `Chunk diagnostics contract mismatch; expected version ${WORLDMAP_CHUNK_DIAGNOSTICS_CONTRACT_VERSION}.`,
      metric,
      baselineP95Ms: null,
      currentP95Ms: null,
      allowedRegressionFraction,
      regressionFraction: null,
    };
  }

  if (
    baselineSamples.length < minimumSamples ||
    currentSamples.length < minimumSamples ||
    baselineP95Ms === null ||
    currentP95Ms === null
  ) {
    return {
      status: "pending",
      reason: `Insufficient ${metricLabel} samples for p95 comparison; need ${minimumSamples} finite observations.`,
      metric,
      baselineP95Ms,
      currentP95Ms,
      allowedRegressionFraction,
      regressionFraction: null,
    };
  }

  if (baselineP95Ms <= 0) {
    if (currentP95Ms <= 0) {
      return {
        status: "pass",
        metric,
        baselineP95Ms,
        currentP95Ms,
        allowedRegressionFraction,
        regressionFraction: 0,
      };
    }

    return {
      status: "fail",
      metric,
      reason: "Baseline p95 is zero; current p95 must also be zero to avoid regression ambiguity.",
      baselineP95Ms,
      currentP95Ms,
      allowedRegressionFraction,
      regressionFraction: Infinity,
    };
  }

  const regressionFraction = (currentP95Ms - baselineP95Ms) / baselineP95Ms;
  if (regressionFraction <= allowedRegressionFraction) {
    return {
      status: "pass",
      metric,
      baselineP95Ms,
      currentP95Ms,
      allowedRegressionFraction,
      regressionFraction,
    };
  }

  return {
    status: "fail",
    metric,
    reason: `${metricLabel} p95 regression ${Math.round(regressionFraction * 1000) / 10}% exceeds allowed ${Math.round(allowedRegressionFraction * 1000) / 10}% threshold.`,
    baselineP95Ms,
    currentP95Ms,
    allowedRegressionFraction,
    regressionFraction,
  };
}
