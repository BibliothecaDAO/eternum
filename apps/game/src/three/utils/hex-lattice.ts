import type { HexPosition } from "@bibliothecadao/types";

/**
 * The hex lattice both scenes draw on: pointy-top hexes of radius 1, odd rows shifted half a hex. Pure lattice math
 * with no origin; the world map applies its floating origin on top (world-origin.ts), the local realm scene uses it as
 * it is.
 */
export const HEX_HORIZONTAL_SPACING = Math.sqrt(3);
export const HEX_VERTICAL_SPACING = 1.5;

const rowOffset = (row: number): number => ((row % 2) * Math.sign(row) * HEX_HORIZONTAL_SPACING) / 2;

export function latticeToWorld(col: number, row: number): { x: number; z: number } {
  return { x: col * HEX_HORIZONTAL_SPACING - rowOffset(row), z: row * HEX_VERTICAL_SPACING };
}

/** The lattice hex whose centre is nearest a world point; ties go to the lower row, then the lower column. */
export function latticeHexAt(worldX: number, worldZ: number): HexPosition {
  const epsilon = 1e-12;
  const estimatedRow = Math.round(worldZ / HEX_VERTICAL_SPACING);
  const estimatedOffset = rowOffset(estimatedRow);
  const estimatedCol = Math.round((worldX + estimatedOffset) / HEX_HORIZONTAL_SPACING);
  // Compare in a frame near the estimated cell so large coordinates keep their precision.
  const localWorldX = worldX - (estimatedCol * HEX_HORIZONTAL_SPACING - estimatedOffset);
  const localWorldZ = worldZ - estimatedRow * HEX_VERTICAL_SPACING;

  let bestRow = estimatedRow;
  let bestCol = estimatedCol;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  for (let row = estimatedRow - 1; row <= estimatedRow + 1; row += 1) {
    const offset = rowOffset(row);
    const nearestColForRow = Math.round((worldX + offset) / HEX_HORIZONTAL_SPACING);
    const localCenterZ = (row - estimatedRow) * HEX_VERTICAL_SPACING;
    for (let col = nearestColForRow - 1; col <= nearestColForRow + 1; col += 1) {
      const localCenterX = (col - estimatedCol) * HEX_HORIZONTAL_SPACING - (offset - estimatedOffset);
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

/**
 * Lattice hexes that can touch a world rectangle: half a column for odd-row staggering, and one more cell so every hex
 * whose outline reaches the rectangle is included.
 */
export function latticeHexBoundsForWorldRect(rect: { minX: number; minZ: number; maxX: number; maxZ: number }): {
  minCol: number;
  minRow: number;
  maxCol: number;
  maxRow: number;
} {
  return {
    minCol: Math.floor(rect.minX / HEX_HORIZONTAL_SPACING - 0.5) - 1,
    minRow: Math.floor(rect.minZ / HEX_VERTICAL_SPACING) - 1,
    maxCol: Math.ceil(rect.maxX / HEX_HORIZONTAL_SPACING + 0.5) + 1,
    maxRow: Math.ceil(rect.maxZ / HEX_VERTICAL_SPACING) + 1,
  };
}
