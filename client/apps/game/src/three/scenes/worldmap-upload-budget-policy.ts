const MATRIX_UPLOAD_BYTES_PER_INSTANCE = Float32Array.BYTES_PER_ELEMENT * 16;
const COLOR_UPLOAD_BYTES_PER_INSTANCE = Float32Array.BYTES_PER_ELEMENT * 3;

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
