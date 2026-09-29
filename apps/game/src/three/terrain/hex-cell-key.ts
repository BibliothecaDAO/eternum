import { fromRenderHex, toRenderHex } from "../world-origin";

const HEX_CELL_KEY_OFFSET = 32_768;
const HEX_CELL_KEY_STRIDE = 65_536;

/**
 * Dense integer key for a world-map hex, so per-cell sets and maps never build strings. The hex is packed relative
 * to the floating world origin, which keeps every hex the view can reach within ±32,768.
 */
export function hexCellKey(col: number, row: number): number {
  const render = toRenderHex(col, row);
  requireHexCellCoordinate("col", render.col);
  requireHexCellCoordinate("row", render.row);
  return (render.col + HEX_CELL_KEY_OFFSET) * HEX_CELL_KEY_STRIDE + (render.row + HEX_CELL_KEY_OFFSET);
}

/** Inverse of `hexCellKey`. */
export function hexCellFromKey(key: number): { col: number; row: number } {
  return fromRenderHex(
    Math.floor(key / HEX_CELL_KEY_STRIDE) - HEX_CELL_KEY_OFFSET,
    (key % HEX_CELL_KEY_STRIDE) - HEX_CELL_KEY_OFFSET,
  );
}

function requireHexCellCoordinate(name: string, value: number): void {
  if (!Number.isInteger(value) || value < -HEX_CELL_KEY_OFFSET || value >= HEX_CELL_KEY_OFFSET) {
    throw new Error(`Hex cell ${name} must be an integer within ±${HEX_CELL_KEY_OFFSET}: ${String(value)}`);
  }
}
