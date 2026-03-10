interface ChunkRenderSize {
  width: number;
  height: number;
}

interface ChunkBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

/**
 * Compute the center of a chunk given its start row/col and chunk stride.
 * Uses the same rounding strategy everywhere to keep managers in sync.
 */
export function getChunkCenter(startRow: number, startCol: number, chunkSize: number): { row: number; col: number } {
  const halfChunk = chunkSize / 2;
  return {
    row: Math.round(startRow + halfChunk),
    col: Math.round(startCol + halfChunk),
  };
}

/**
 * Compute render bounds (in hex coordinates) for a chunk.
 * This must be shared across map/army/structure managers to avoid edge mismatches.
 */
export function getRenderBounds(
  startRow: number,
  startCol: number,
  renderSize: ChunkRenderSize,
  chunkSize: number,
): ChunkBounds {
  const { row: chunkCenterRow, col: chunkCenterCol } = getChunkCenter(startRow, startCol, chunkSize);
  const width = Math.max(0, Math.floor(renderSize.width));
  const height = Math.max(0, Math.floor(renderSize.height));
  const minCol = chunkCenterCol - Math.floor(width / 2);
  const minRow = chunkCenterRow - Math.floor(height / 2);
  return {
    minCol,
    maxCol: minCol + width - 1,
    minRow,
    maxRow: minRow + height - 1,
  };
}

export function isHexWithinRenderBounds(
  col: number,
  row: number,
  startRow: number,
  startCol: number,
  renderSize: ChunkRenderSize,
  chunkSize: number,
): boolean {
  const bounds = getRenderBounds(startRow, startCol, renderSize, chunkSize);
  return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
}

interface ChunkKeyOverlapInput {
  chunkKeys: Iterable<string>;
  col: number;
  row: number;
  renderSize: ChunkRenderSize;
  chunkSize: number;
}

interface PotentialChunkKeyOverlapInput {
  col: number;
  row: number;
  renderSize: ChunkRenderSize;
  chunkSize: number;
}

function getPotentialChunkStartsContainingCoordinate(
  coordinate: number,
  renderSpan: number,
  chunkSize: number,
): number[] {
  const normalizedRenderSpan = Math.max(0, Math.floor(renderSpan));
  const normalizedChunkSize = Math.max(1, Math.floor(chunkSize));

  if (!Number.isFinite(coordinate) || normalizedRenderSpan === 0) {
    return [];
  }

  const halfRenderSpan = Math.floor(normalizedRenderSpan / 2);
  const centerOffset = Math.round(normalizedChunkSize / 2);
  const minStart = coordinate - centerOffset + halfRenderSpan - (normalizedRenderSpan - 1);
  const maxStart = coordinate - centerOffset + halfRenderSpan;
  const firstStart = Math.ceil(minStart / normalizedChunkSize) * normalizedChunkSize;
  const chunkStarts: number[] = [];

  for (let start = firstStart; start <= maxStart; start += normalizedChunkSize) {
    chunkStarts.push(start);
  }

  return chunkStarts;
}

/**
 * Return cached chunk keys whose render windows include the provided hex.
 * This is used to invalidate every overlapping render cache, not just the
 * chunk that contains the hex by stride coordinates.
 */
export function getChunkKeysContainingHexInRenderBounds(input: ChunkKeyOverlapInput): string[] {
  const matches: string[] = [];

  for (const chunkKey of input.chunkKeys) {
    const [startRow, startCol] = chunkKey.split(",").map(Number);
    if (!Number.isFinite(startRow) || !Number.isFinite(startCol)) {
      continue;
    }

    if (isHexWithinRenderBounds(input.col, input.row, startRow, startCol, input.renderSize, input.chunkSize)) {
      matches.push(chunkKey);
    }
  }

  return matches;
}

/**
 * Derive the bounded set of stride-aligned chunk keys whose render windows can
 * possibly include the provided hex. This avoids scanning every cached chunk key
 * when overlap size is determined entirely by render size and chunk stride.
 */
export function getPotentialChunkKeysContainingHexInRenderBounds(input: PotentialChunkKeyOverlapInput): string[] {
  const candidateRows = getPotentialChunkStartsContainingCoordinate(input.row, input.renderSize.height, input.chunkSize);
  const candidateCols = getPotentialChunkStartsContainingCoordinate(input.col, input.renderSize.width, input.chunkSize);
  const matches: string[] = [];

  for (const startRow of candidateRows) {
    for (const startCol of candidateCols) {
      if (isHexWithinRenderBounds(input.col, input.row, startRow, startCol, input.renderSize, input.chunkSize)) {
        matches.push(`${startRow},${startCol}`);
      }
    }
  }

  return matches;
}
