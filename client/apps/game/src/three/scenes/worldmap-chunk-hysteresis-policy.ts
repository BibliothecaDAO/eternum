/**
 * Pure policy: determines whether to stay in the current chunk or switch.
 *
 * A "hold band" is an inner rectangle of the current chunk's render bounds.
 * While the focus hex remains inside the hold band we keep the current chunk.
 * Once the focus exits the hold band we switch to the target chunk.
 */

import { getChunkCenter, getRenderBounds } from "../utils/chunk-geometry";
import { resolveChunkKeyFromHex } from "./worldmap-chunk-selection-policy";

// ── public interfaces ───────────────────────────────────────────────────────

interface WorldmapChunkHysteresisInput {
  focusCol: number;
  focusRow: number;
  currentChunkStartRow: number;
  currentChunkStartCol: number;
  chunkSize: number;
  renderSize: { width: number; height: number };
  /** Fraction of render window to use as hold band (0.0-1.0). Default 0.25 */
  holdBandFraction?: number;
}

interface WorldmapChunkHysteresisDecision {
  shouldStayInCurrentChunk: boolean;
  shouldSwitchToTargetChunk: boolean;
  targetChunkKey: string | null;
}

// ── main entry point ────────────────────────────────────────────────────────

export function resolveWorldmapChunkHysteresis(input: WorldmapChunkHysteresisInput): WorldmapChunkHysteresisDecision {
  const holdBandFraction = input.holdBandFraction ?? 0.25;

  // Compute the render bounds of the current chunk
  const bounds = getRenderBounds(
    input.currentChunkStartRow,
    input.currentChunkStartCol,
    input.renderSize,
    input.chunkSize,
  );

  // Inset the render bounds by holdBandFraction to form the hold band
  const insetCol = Math.floor(holdBandFraction * input.renderSize.width);
  const insetRow = Math.floor(holdBandFraction * input.renderSize.height);

  const holdMinCol = bounds.minCol + insetCol;
  const holdMaxCol = bounds.maxCol - insetCol;
  const holdMinRow = bounds.minRow + insetRow;
  const holdMaxRow = bounds.maxRow - insetRow;

  const insideHoldBand =
    input.focusCol >= holdMinCol &&
    input.focusCol <= holdMaxCol &&
    input.focusRow >= holdMinRow &&
    input.focusRow <= holdMaxRow;

  if (insideHoldBand) {
    return {
      shouldStayInCurrentChunk: true,
      shouldSwitchToTargetChunk: false,
      targetChunkKey: null,
    };
  }

  // Focus is outside the hold band -- compute the target chunk
  const { chunkKey } = resolveChunkKeyFromHex(input.focusCol, input.focusRow, input.chunkSize);

  return {
    shouldStayInCurrentChunk: false,
    shouldSwitchToTargetChunk: true,
    targetChunkKey: chunkKey,
  };
}
