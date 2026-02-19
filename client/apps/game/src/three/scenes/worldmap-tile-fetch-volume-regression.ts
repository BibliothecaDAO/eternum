import type { WorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";

interface EvaluateTileFetchVolumeRegressionInput {
  baseline: WorldmapChunkDiagnostics;
  current: WorldmapChunkDiagnostics;
  allowedIncreaseFraction?: number;
}

interface TileFetchVolumeRegressionBaseResult {
  baselineFetchCount: number;
  currentFetchCount: number;
  allowedIncreaseFraction: number;
  increaseFraction: number;
}

interface TileFetchVolumeRegressionPassResult extends TileFetchVolumeRegressionBaseResult {
  status: "pass";
}

interface TileFetchVolumeRegressionFailResult extends TileFetchVolumeRegressionBaseResult {
  status: "fail";
  reason: string;
}

export type TileFetchVolumeRegressionResult = TileFetchVolumeRegressionPassResult | TileFetchVolumeRegressionFailResult;

export function evaluateTileFetchVolumeRegression(
  input: EvaluateTileFetchVolumeRegressionInput,
): TileFetchVolumeRegressionResult {
  const allowedIncreaseFraction = Math.max(0, input.allowedIncreaseFraction ?? 0);
  const baselineFetchCount = Math.max(0, Math.floor(input.baseline.tileFetchStarted));
  const currentFetchCount = Math.max(0, Math.floor(input.current.tileFetchStarted));

  if (baselineFetchCount === 0) {
    if (currentFetchCount === 0) {
      return {
        status: "pass",
        baselineFetchCount,
        currentFetchCount,
        allowedIncreaseFraction,
        increaseFraction: 0,
      };
    }

    return {
      status: "fail",
      reason: "Baseline tile fetch count is zero; current fetch count must also be zero.",
      baselineFetchCount,
      currentFetchCount,
      allowedIncreaseFraction,
      increaseFraction: Number.POSITIVE_INFINITY,
    };
  }

  const increaseFraction = (currentFetchCount - baselineFetchCount) / baselineFetchCount;
  if (increaseFraction <= allowedIncreaseFraction) {
    return {
      status: "pass",
      baselineFetchCount,
      currentFetchCount,
      allowedIncreaseFraction,
      increaseFraction,
    };
  }

  return {
    status: "fail",
    reason: `Tile fetch volume increased by ${Math.round(increaseFraction * 1000) / 10}% which exceeds allowed ${Math.round(allowedIncreaseFraction * 1000) / 10}%.`,
    baselineFetchCount,
    currentFetchCount,
    allowedIncreaseFraction,
    increaseFraction,
  };
}
