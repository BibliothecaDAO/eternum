const MATRIX_UPLOAD_BYTES_PER_INSTANCE = Float32Array.BYTES_PER_ELEMENT * 16;
const COLOR_UPLOAD_BYTES_PER_INSTANCE = Float32Array.BYTES_PER_ELEMENT * 3;

export type WorldmapUploadWorkStage = "presentation_prewarm" | "visible_commit";

export function classifyWorldmapUploadWork(input: {
  colorInstanceCount: number;
  matrixInstanceCount: number;
  isCachedReplay: boolean;
  stage: WorldmapUploadWorkStage;
}): {
  stage: WorldmapUploadWorkStage;
  estimatedUploadBytes: number;
} {
  const estimatedUploadBytes = input.isCachedReplay
    ? estimateWorldmapCachedReplayUploadBytes(input)
    : estimateWorldmapColdBuildUploadBytes(input);

  return {
    stage: input.stage,
    estimatedUploadBytes,
  };
}

export function resolveWorldmapPostCommitWorkAction(input: {
  estimatedUploadBytes: number;
  budgetBytes: number;
}): "immediate" | "deferred" {
  return input.estimatedUploadBytes > input.budgetBytes ? "deferred" : "immediate";
}

export function estimateWorldmapCachedReplayUploadBytes(input: {
  colorInstanceCount: number;
  matrixInstanceCount: number;
}): number {
  return (
    input.matrixInstanceCount * MATRIX_UPLOAD_BYTES_PER_INSTANCE +
    input.colorInstanceCount * COLOR_UPLOAD_BYTES_PER_INSTANCE
  );
}

export function estimateWorldmapColdBuildUploadBytes(input: {
  colorInstanceCount: number;
  matrixInstanceCount: number;
}): number {
  const cachedReplayBytes = estimateWorldmapCachedReplayUploadBytes(input);

  // Cold builds still pay the initial per-instance matrix writes before the final batched mesh update.
  return cachedReplayBytes + input.matrixInstanceCount * MATRIX_UPLOAD_BYTES_PER_INSTANCE;
}
