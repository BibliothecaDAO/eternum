/**
 * Pure policy module: derives chunk ownership from hex-space rather than
 * raw world-floor math.  No THREE / browser dependencies.
 *
 * The hex layout assumes HEX_SIZE = 1 (flat-top hexagons):
 *   hexWidth  = sqrt(3)
 *   hexHeight = 2
 *   vertDist  = 1.5
 *   horizDist = sqrt(3)
 */

// ── hex constants (HEX_SIZE = 1) ────────────────────────────────────────────

const HORIZ_DIST = Math.sqrt(3);
const VERT_DIST = 1.5;

// ── row-offset helper (identical to utils.ts getRowOffset) ──────────────────

function getRowOffset(row: number): number {
  return ((row % 2) * Math.sign(row) * HORIZ_DIST) / 2;
}

// ── public interfaces ───────────────────────────────────────────────────────

interface WorldmapChunkSelectionInput {
  worldX: number;
  worldZ: number;
  chunkSize: number;
}

interface WorldmapChunkSelectionResult {
  focusCol: number;
  focusRow: number;
  startCol: number;
  startRow: number;
  chunkKey: string;
}

// ── world → hex conversion (pure, no Vector3) ──────────────────────────────

/**
 * Convert a world (x, z) position to the nearest hex coordinate using the
 * same parity-aware 9-cell neighbourhood search as `getHexForWorldPosition`
 * in utils.ts, but without any THREE dependency.
 */
function worldToHex(worldX: number, worldZ: number): { col: number; row: number } {
  const epsilon = 1e-12;

  const estimatedRow = Math.round(worldZ / VERT_DIST);
  const estimatedOffset = getRowOffset(estimatedRow);
  const estimatedCol = Math.round((worldX + estimatedOffset) / HORIZ_DIST);
  const originX = estimatedCol * HORIZ_DIST - estimatedOffset;
  const originZ = estimatedRow * VERT_DIST;
  const localWorldX = worldX - originX;
  const localWorldZ = worldZ - originZ;

  let bestRow = estimatedRow;
  let bestCol = estimatedCol;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let row = estimatedRow - 1; row <= estimatedRow + 1; row += 1) {
    const rowOffset = getRowOffset(row);
    const nearestColForRow = Math.round((worldX + rowOffset) / HORIZ_DIST);
    const localCenterZ = (row - estimatedRow) * VERT_DIST;

    for (let col = nearestColForRow - 1; col <= nearestColForRow + 1; col += 1) {
      const localCenterX = (col - estimatedCol) * HORIZ_DIST - (rowOffset - estimatedOffset);
      const dx = localWorldX - localCenterX;
      const dz = localWorldZ - localCenterZ;
      const distanceSquared = dx * dx + dz * dz;

      if (
        distanceSquared < bestDistanceSquared - epsilon ||
        (Math.abs(distanceSquared - bestDistanceSquared) <= epsilon &&
          (row < bestRow || (row === bestRow && col < bestCol)))
      ) {
        bestDistanceSquared = distanceSquared;
        bestRow = row;
        bestCol = col;
      }
    }
  }

  return { col: bestCol, row: bestRow };
}

// ── chunk key derivation ────────────────────────────────────────────────────

/**
 * Pure function: hex coordinates -> chunk key.
 * Snaps row/col to the chunk stride boundary.
 */
export function resolveChunkKeyFromHex(
  col: number,
  row: number,
  chunkSize: number,
): { startCol: number; startRow: number; chunkKey: string } {
  const startCol = Math.floor(col / chunkSize) * chunkSize;
  const startRow = Math.floor(row / chunkSize) * chunkSize;
  return { startCol, startRow, chunkKey: `${startRow},${startCol}` };
}

// ── main entry point ────────────────────────────────────────────────────────

/**
 * Pure function: world position -> hex-space chunk selection.
 *
 * 1. Converts world (x, z) to the nearest hex (col, row) using the same
 *    parity-aware algorithm as the renderer.
 * 2. Derives chunk key from the hex coordinates.
 */
export function resolveWorldmapChunkFromWorldPosition(
  input: WorldmapChunkSelectionInput,
): WorldmapChunkSelectionResult {
  const { col: focusCol, row: focusRow } = worldToHex(input.worldX, input.worldZ);
  const { startCol, startRow, chunkKey } = resolveChunkKeyFromHex(focusCol, focusRow, input.chunkSize);
  return { focusCol, focusRow, startCol, startRow, chunkKey };
}
