export interface HexGridRowMetadata {
  globalRow: number;
  baseZ: number;
  rowOffsetValue: number;
}

export interface HexGridProcessingPlan {
  frameBudgetMs: number;
  minBatch: number;
  maxBatch: number;
}

export function buildHexGridRowMetadata(options: {
  rows: number;
  halfRows: number;
  chunkCenterRow: number;
  vertDist: number;
  horizDist: number;
}): HexGridRowMetadata[] {
  const { rows, halfRows, chunkCenterRow, vertDist, horizDist } = options;
  const metadata: HexGridRowMetadata[] = new Array(rows);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const rowOffset = rowIndex - halfRows;
    const globalRow = chunkCenterRow + rowOffset;
    metadata[rowIndex] = {
      globalRow,
      baseZ: globalRow * vertDist,
      rowOffsetValue: ((globalRow % 2) * Math.sign(globalRow) * horizDist) / 2,
    };
  }

  return metadata;
}

export function resolveHexGridProcessingPlan(options: {
  totalHexes: number;
  baseFrameBudgetMs: number;
  baseMinBatch: number;
  baseMaxBatch: number;
  isChunkTransitioning: boolean;
  isChunkRefreshRunning: boolean;
}): HexGridProcessingPlan {
  const {
    totalHexes,
    baseFrameBudgetMs,
    baseMinBatch,
    baseMaxBatch,
    isChunkTransitioning,
    isChunkRefreshRunning,
  } = options;

  const safeTotalHexes = Math.max(1, Math.floor(totalHexes));
  const isHighPriority = isChunkTransitioning || isChunkRefreshRunning;
  const minBatchMultiplier = isHighPriority ? 2 : 1;
  const maxBatchMultiplier = isHighPriority ? 1.75 : 1;
  const frameBudgetMs = isHighPriority ? baseFrameBudgetMs + 3.5 : baseFrameBudgetMs;

  const minBatch = Math.min(safeTotalHexes, Math.max(1, Math.floor(baseMinBatch * minBatchMultiplier)));
  const maxBatch = Math.max(minBatch, Math.min(safeTotalHexes, Math.floor(baseMaxBatch * maxBatchMultiplier)));

  return {
    frameBudgetMs,
    minBatch,
    maxBatch,
  };
}
