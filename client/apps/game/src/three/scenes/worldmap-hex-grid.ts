import { getRenderBounds } from "../utils/chunk-geometry";

interface HexGridRowMetadata {
  globalRow: number;
  baseZ: number;
  rowOffsetValue: number;
  baseXAtColZero: number;
}

interface HexGridProcessingPlan {
  frameBudgetMs: number;
  minBatch: number;
  maxBatch: number;
}

interface HexGridBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

type HexGridStripUpdatePlan =
  | {
      mode: "full";
      previousBounds: HexGridBounds;
      nextBounds: HexGridBounds;
      retainedBounds: null;
      incomingBounds: null;
    }
  | {
      mode: "strip";
      axis: "row" | "col";
      direction: -1 | 1;
      previousBounds: HexGridBounds;
      nextBounds: HexGridBounds;
      retainedBounds: HexGridBounds;
      incomingBounds: HexGridBounds;
    };

export function resolveHexGridRetainedBounds(previousBounds: HexGridBounds, nextBounds: HexGridBounds): HexGridBounds | null {
  const minCol = Math.max(previousBounds.minCol, nextBounds.minCol);
  const maxCol = Math.min(previousBounds.maxCol, nextBounds.maxCol);
  const minRow = Math.max(previousBounds.minRow, nextBounds.minRow);
  const maxRow = Math.min(previousBounds.maxRow, nextBounds.maxRow);

  if (minCol > maxCol || minRow > maxRow) {
    return null;
  }

  return {
    minCol,
    maxCol,
    minRow,
    maxRow,
  };
}

export function resolveHexGridStripUpdatePlan(options: {
  previousStartRow: number;
  previousStartCol: number;
  nextStartRow: number;
  nextStartCol: number;
  renderSize: { width: number; height: number };
  chunkSize: number;
}): HexGridStripUpdatePlan {
  const previousBounds = getRenderBounds(
    options.previousStartRow,
    options.previousStartCol,
    options.renderSize,
    options.chunkSize,
  );
  const nextBounds = getRenderBounds(options.nextStartRow, options.nextStartCol, options.renderSize, options.chunkSize);
  const retainedBounds = resolveHexGridRetainedBounds(previousBounds, nextBounds);
  const deltaRow = options.nextStartRow - options.previousStartRow;
  const deltaCol = options.nextStartCol - options.previousStartCol;
  const movedExactlyOneChunkRow = Math.abs(deltaRow) === options.chunkSize && deltaCol === 0;
  const movedExactlyOneChunkCol = Math.abs(deltaCol) === options.chunkSize && deltaRow === 0;

  if (!retainedBounds || (!movedExactlyOneChunkRow && !movedExactlyOneChunkCol)) {
    return {
      mode: "full",
      previousBounds,
      nextBounds,
      retainedBounds: null,
      incomingBounds: null,
    };
  }

  if (movedExactlyOneChunkCol) {
    const direction = deltaCol > 0 ? 1 : -1;
    return {
      mode: "strip",
      axis: "col",
      direction,
      previousBounds,
      nextBounds,
      retainedBounds,
      incomingBounds:
        direction > 0
          ? {
              minCol: nextBounds.maxCol - options.chunkSize + 1,
              maxCol: nextBounds.maxCol,
              minRow: nextBounds.minRow,
              maxRow: nextBounds.maxRow,
            }
          : {
              minCol: nextBounds.minCol,
              maxCol: nextBounds.minCol + options.chunkSize - 1,
              minRow: nextBounds.minRow,
              maxRow: nextBounds.maxRow,
            },
    };
  }

  const direction = deltaRow > 0 ? 1 : -1;
  return {
    mode: "strip",
    axis: "row",
    direction,
    previousBounds,
    nextBounds,
    retainedBounds,
    incomingBounds:
      direction > 0
        ? {
            minCol: nextBounds.minCol,
            maxCol: nextBounds.maxCol,
            minRow: nextBounds.maxRow - options.chunkSize + 1,
            maxRow: nextBounds.maxRow,
          }
        : {
            minCol: nextBounds.minCol,
            maxCol: nextBounds.maxCol,
            minRow: nextBounds.minRow,
            maxRow: nextBounds.minRow + options.chunkSize - 1,
          },
  };
}

export function buildHexGridRowMetadata(options: {
  rows: number;
  halfRows: number;
  halfCols: number;
  chunkCenterRow: number;
  chunkCenterCol: number;
  vertDist: number;
  horizDist: number;
}): HexGridRowMetadata[] {
  const { rows, halfRows, halfCols, chunkCenterRow, chunkCenterCol, vertDist, horizDist } = options;
  const metadata: HexGridRowMetadata[] = new Array(rows);
  const chunkStartCol = chunkCenterCol - halfCols;

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const rowOffset = rowIndex - halfRows;
    const globalRow = chunkCenterRow + rowOffset;
    const rowOffsetValue = ((globalRow % 2) * Math.sign(globalRow) * horizDist) / 2;
    metadata[rowIndex] = {
      globalRow,
      baseZ: globalRow * vertDist,
      rowOffsetValue,
      baseXAtColZero: chunkStartCol * horizDist - rowOffsetValue,
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
  const { totalHexes, baseFrameBudgetMs, baseMinBatch, baseMaxBatch, isChunkTransitioning, isChunkRefreshRunning } =
    options;

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
