import { HexLocation } from "../model/types";

// Constants for hexagon grid calculations
const SQRT_3 = Math.sqrt(3);

/**
 * Converts hex grid coordinates to pixel position
 * Using the same system as in the game's codebase
 */
export function hexToPixel(hex: HexLocation, hexSize: number): { x: number; y: number } {
  const hexHeight = hexSize * 2;
  const hexWidth = SQRT_3 * hexSize;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;

  // Calculate row offset based on row parity (even/odd)
  const rowOffset = ((hex.row % 2) * Math.sign(hex.row) * horizDist) / 2;

  // Convert to pixel coordinates
  const x = hex.col * horizDist - rowOffset;
  const y = hex.row * vertDist;

  return { x, y };
}

/**
 * Converts pixel position to hex grid coordinates
 * Using the same system as in the game's codebase
 * The pixel position should be relative to the center of the grid
 */
export function pixelToHex(x: number, y: number, hexSize: number): HexLocation {
  const hexHeight = hexSize * 2;
  const hexWidth = SQRT_3 * hexSize;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;

  // First approximate the row based on y
  const tempRow = Math.round(y / vertDist);

  // Calculate the row offset for this approximate row
  const rowOffset = ((tempRow % 2) * Math.sign(tempRow) * horizDist) / 2;

  // Now calculate the column taking row offset into account
  const tempCol = Math.round((x + rowOffset) / horizDist);

  // Refine approximation by checking nearest hexes
  // Create a temporary location
  const tempHex = { col: tempCol, row: tempRow };

  // Create a list of candidate hex positions (the approximate one and its neighbors)
  const candidates = [
    tempHex,
    { col: tempCol + 1, row: tempRow },
    { col: tempCol - 1, row: tempRow },
    { col: tempCol, row: tempRow + 1 },
    { col: tempCol, row: tempRow - 1 },
    { col: tempCol + (tempRow % 2 === 0 ? 0 : 1), row: tempRow + 1 },
    { col: tempCol + (tempRow % 2 === 0 ? 0 : 1), row: tempRow - 1 },
    { col: tempCol + (tempRow % 2 === 0 ? -1 : 0), row: tempRow + 1 },
    { col: tempCol + (tempRow % 2 === 0 ? -1 : 0), row: tempRow - 1 },
  ];

  // Find the candidate with the smallest distance to the click
  let minDist = Number.MAX_VALUE;
  let closestHex = tempHex;

  for (const candidate of candidates) {
    const pixelPos = hexToPixel(candidate, hexSize);
    const dist = Math.pow(pixelPos.x - x, 2) + Math.pow(pixelPos.y - y, 2);

    if (dist < minDist) {
      minDist = dist;
      closestHex = candidate;
    }
  }

  return closestHex;
}

/**
 * Calculates the distance between two hex coordinates
 */
export function hexDistance(a: HexLocation, b: HexLocation): number {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
}

/**
 * Converts axial coordinates to cube coordinates
 */
export function axialToCube(hex: { col: number; row: number }): CubeCoord {
  const x = hex.col;
  const z = hex.row;
  const y = -x - z;
  return { x, y, z };
}

/**
 * Cube coordinate system helper
 */
interface CubeCoord {
  x: number;
  y: number;
  z: number;
}

/**
 * Creates a pulse animation value based on time
 * @returns A value between 0 and 1 for the pulse effect
 */
export function getPulseAnimation(): number {
  const time = Date.now() / 1000;
  return (Math.sin(time * 3) + 1) / 2; // Oscillates between 0 and 1
}
