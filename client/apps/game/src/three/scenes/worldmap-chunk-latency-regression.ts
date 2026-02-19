import type { WorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";

interface EvaluateChunkSwitchP95RegressionInput {
  baseline: WorldmapChunkDiagnostics;
  current: WorldmapChunkDiagnostics;
  allowedRegressionFraction?: number;
}

interface ChunkSwitchP95RegressionBaseResult {
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

export function evaluateChunkSwitchP95Regression(
  input: EvaluateChunkSwitchP95RegressionInput,
): ChunkSwitchP95RegressionResult {
  const allowedRegressionFraction = Math.max(0, input.allowedRegressionFraction ?? 0.1);
  const baselineP95Ms = getP95(input.baseline.switchDurationMsSamples);
  const currentP95Ms = getP95(input.current.switchDurationMsSamples);

  if (baselineP95Ms === null || currentP95Ms === null) {
    return {
      status: "pending",
      reason: "Insufficient chunk-switch samples for p95 comparison.",
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
        baselineP95Ms,
        currentP95Ms,
        allowedRegressionFraction,
        regressionFraction: 0,
      };
    }

    return {
      status: "fail",
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
      baselineP95Ms,
      currentP95Ms,
      allowedRegressionFraction,
      regressionFraction,
    };
  }

  return {
    status: "fail",
    reason: `Chunk-switch p95 regression ${Math.round(regressionFraction * 1000) / 10}% exceeds allowed ${Math.round(allowedRegressionFraction * 1000) / 10}% threshold.`,
    baselineP95Ms,
    currentP95Ms,
    allowedRegressionFraction,
    regressionFraction,
  };
}
