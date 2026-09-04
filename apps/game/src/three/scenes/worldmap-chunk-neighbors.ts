interface ChunkRenderSize {
  width: number;
  height: number;
}

interface RenderOverlapChunkKeysInput {
  centerChunkKey: string;
  renderSize: ChunkRenderSize;
  chunkSize: number;
}

function parseChunkKey(chunkKey: string): { startRow: number; startCol: number } | null {
  const [startRow, startCol] = chunkKey.split(",").map(Number);
  if (!Number.isFinite(startRow) || !Number.isFinite(startCol)) {
    return null;
  }

  return { startRow, startCol };
}

function normalizeDimension(value: number): number {
  return Math.max(0, Math.floor(value));
}

function normalizeChunkSize(chunkSize: number): number {
  return Math.max(1, Math.floor(chunkSize));
}

/**
 * Number of stride steps from center chunk where render windows still overlap.
 * Uses overlap interval math instead of half-window stepping so all sizes are covered.
 */
export function getRenderOverlapStrideRadius(renderDimension: number, chunkSize: number): number {
  const dimension = normalizeDimension(renderDimension);
  if (dimension <= 0) {
    return 0;
  }

  const stride = normalizeChunkSize(chunkSize);
  return Math.max(0, Math.floor((dimension - 1) / stride));
}

/**
 * Return stride-aligned chunk keys whose render windows overlap the center chunk render window.
 * Includes the center chunk key.
 */
export function getRenderOverlapChunkKeys(input: RenderOverlapChunkKeysInput): string[] {
  const center = parseChunkKey(input.centerChunkKey);
  if (!center) {
    return [];
  }

  const stride = normalizeChunkSize(input.chunkSize);
  const rowRadius = getRenderOverlapStrideRadius(input.renderSize.height, stride);
  const colRadius = getRenderOverlapStrideRadius(input.renderSize.width, stride);
  const chunkKeys: string[] = [];

  for (let rowOffset = -rowRadius; rowOffset <= rowRadius; rowOffset += 1) {
    for (let colOffset = -colRadius; colOffset <= colRadius; colOffset += 1) {
      const startRow = center.startRow + rowOffset * stride;
      const startCol = center.startCol + colOffset * stride;
      chunkKeys.push(`${startRow},${startCol}`);
    }
  }

  return chunkKeys;
}

/**
 * Same as getRenderOverlapChunkKeys, excluding the center chunk.
 */
export function getRenderOverlapNeighborChunkKeys(input: RenderOverlapChunkKeysInput): string[] {
  return getRenderOverlapChunkKeys(input).filter((chunkKey) => chunkKey !== input.centerChunkKey);
}
