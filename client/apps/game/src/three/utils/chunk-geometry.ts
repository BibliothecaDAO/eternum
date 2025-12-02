import { getWorldPositionForHex } from "./utils";

export interface ChunkRenderSize {
  width: number;
  height: number;
}

export interface ChunkBounds {
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
  const halfWidth = renderSize.width / 2;
  const halfHeight = renderSize.height / 2;
  return {
    minCol: chunkCenterCol - halfWidth,
    maxCol: chunkCenterCol + halfWidth,
    minRow: chunkCenterRow - halfHeight,
    maxRow: chunkCenterRow + halfHeight,
  };
}

/**
 * Compute world-space Box3/Sphere bounds for the render area.
 */
export function getWorldBoundsForRenderArea(
  startRow: number,
  startCol: number,
  renderSize: ChunkRenderSize,
  chunkSize: number,
) {
  const bounds = getRenderBounds(startRow, startCol, renderSize, chunkSize);
  const corners = [
    getWorldPositionForHex({ col: bounds.minCol, row: bounds.minRow }),
    getWorldPositionForHex({ col: bounds.minCol, row: bounds.maxRow }),
    getWorldPositionForHex({ col: bounds.maxCol, row: bounds.minRow }),
    getWorldPositionForHex({ col: bounds.maxCol, row: bounds.maxRow }),
  ];
  return { corners };
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
