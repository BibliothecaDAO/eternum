const HEX_CELL_KEY_OFFSET = 32_768;
const HEX_CELL_KEY_STRIDE = 65_536;

/** Dense integer key for a render-space hex within ±32,768, so per-cell sets and maps never build strings. */
export function hexCellKey(col: number, row: number): number {
  requireHexCellCoordinate("col", col);
  requireHexCellCoordinate("row", row);
  return (col + HEX_CELL_KEY_OFFSET) * HEX_CELL_KEY_STRIDE + (row + HEX_CELL_KEY_OFFSET);
}

/** Inverse of `hexCellKey`. */
export function hexCellFromKey(key: number): { col: number; row: number } {
  return {
    col: Math.floor(key / HEX_CELL_KEY_STRIDE) - HEX_CELL_KEY_OFFSET,
    row: (key % HEX_CELL_KEY_STRIDE) - HEX_CELL_KEY_OFFSET,
  };
}

function requireHexCellCoordinate(name: string, value: number): void {
  if (!Number.isInteger(value) || value < -HEX_CELL_KEY_OFFSET || value >= HEX_CELL_KEY_OFFSET) {
    throw new Error(`Hex cell ${name} must be an integer within ±${HEX_CELL_KEY_OFFSET}: ${String(value)}`);
  }
}
