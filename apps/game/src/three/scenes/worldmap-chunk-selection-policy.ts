/**
 * Pure policy module: derives chunk ownership from hex-space rather than
 * raw world-floor math.  No THREE / browser dependencies.
 */
import { worldHexAt } from "../world-origin";

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

interface WorldmapChunkHexSelectionInput {
  col: number;
  row: number;
  chunkSize: number;
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
 * 1. Converts world (x, z) to the nearest world-map hex through the floating origin.
 * 2. Derives chunk key from the hex coordinates.
 */
export function resolveWorldmapChunkFromWorldPosition(
  input: WorldmapChunkSelectionInput,
): WorldmapChunkSelectionResult {
  const { col: focusCol, row: focusRow } = worldHexAt(input.worldX, input.worldZ);
  const { startCol, startRow, chunkKey } = resolveChunkKeyFromHex(focusCol, focusRow, input.chunkSize);
  return { focusCol, focusRow, startCol, startRow, chunkKey };
}

export function resolveWorldmapChunkFromHexPosition(
  input: WorldmapChunkHexSelectionInput,
): WorldmapChunkSelectionResult {
  const { startCol, startRow, chunkKey } = resolveChunkKeyFromHex(input.col, input.row, input.chunkSize);
  return {
    focusCol: input.col,
    focusRow: input.row,
    startCol,
    startRow,
    chunkKey,
  };
}
