import type { WorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";

interface EvaluateProjectionSyncVolumeRegressionInput {
  baseline: WorldmapChunkDiagnostics;
  current: WorldmapChunkDiagnostics;
  allowedIncreaseFraction?: number;
}

interface ProjectionSyncVolumeRegressionBaseResult {
  baselineSyncCount: number;
  currentSyncCount: number;
  allowedIncreaseFraction: number;
  increaseFraction: number;
}

interface ProjectionSyncVolumeRegressionPassResult extends ProjectionSyncVolumeRegressionBaseResult {
  status: "pass";
}

interface ProjectionSyncVolumeRegressionFailResult extends ProjectionSyncVolumeRegressionBaseResult {
  status: "fail";
  reason: string;
}

export type ProjectionSyncVolumeRegressionResult =
  | ProjectionSyncVolumeRegressionPassResult
  | ProjectionSyncVolumeRegressionFailResult;

export function evaluateProjectionSyncVolumeRegression(
  input: EvaluateProjectionSyncVolumeRegressionInput,
): ProjectionSyncVolumeRegressionResult {
  const allowedIncreaseFraction = Math.max(0, input.allowedIncreaseFraction ?? 0);
  const baselineSyncCount = Math.max(0, Math.floor(input.baseline.projectionSyncStarted));
  const currentSyncCount = Math.max(0, Math.floor(input.current.projectionSyncStarted));

  if (baselineSyncCount === 0) {
    if (currentSyncCount === 0) {
      return {
        status: "pass",
        baselineSyncCount,
        currentSyncCount,
        allowedIncreaseFraction,
        increaseFraction: 0,
      };
    }

    return {
      status: "fail",
      reason: "Baseline tile sync count is zero; current fetch count must also be zero.",
      baselineSyncCount,
      currentSyncCount,
      allowedIncreaseFraction,
      increaseFraction: Number.POSITIVE_INFINITY,
    };
  }

  const increaseFraction = (currentSyncCount - baselineSyncCount) / baselineSyncCount;
  if (increaseFraction <= allowedIncreaseFraction) {
    return {
      status: "pass",
      baselineSyncCount,
      currentSyncCount,
      allowedIncreaseFraction,
      increaseFraction,
    };
  }

  return {
    status: "fail",
    reason: `Tile sync volume increased by ${Math.round(increaseFraction * 1000) / 10}% which exceeds allowed ${Math.round(allowedIncreaseFraction * 1000) / 10}%.`,
    baselineSyncCount,
    currentSyncCount,
    allowedIncreaseFraction,
    increaseFraction,
  };
}
