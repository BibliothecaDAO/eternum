import { HexLocation } from "../model/types";

// Constants for hexagon grid calculations
const SQRT_3 = Math.sqrt(3);

/**
 * Converts hex grid coordinates to pixel position
 */
export function hexToPixel(hex: HexLocation, hexSize: number): { x: number; y: number } {
  // Using axial coordinate system (q, r)
  // x = size * (3/2 * q)
  // y = size * (sqrt(3)/2 * q + sqrt(3) * r)
  const x = hexSize * ((3 / 2) * hex.col);
  const y = hexSize * ((SQRT_3 / 2) * hex.col + SQRT_3 * hex.row);
  return { x, y };
}

/**
 * Converts pixel position to hex grid coordinates
 * The pixel position should be relative to the center of the grid
 */
export function pixelToHex(x: number, y: number, hexSize: number): HexLocation {
  // Inverse of the formulas used in hexToPixel
  const q = ((2 / 3) * x) / hexSize;
  const r = ((-1 / 3) * x + (SQRT_3 / 3) * y) / hexSize;

  return roundAxial({ col: q, row: r });
}

/**
 * Rounds axial coordinates to the nearest hex
 */
function roundAxial(hex: { col: number; row: number }): HexLocation {
  // Convert to cube coordinates, round, then convert back to axial
  const cube = axialToCube(hex);
  const roundedCube = roundCube(cube);
  return cubeToAxial(roundedCube);
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
 * Rounds cube coordinates to the nearest hex
 */
function roundCube(cube: CubeCoord): CubeCoord {
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);

  const xDiff = Math.abs(rx - cube.x);
  const yDiff = Math.abs(ry - cube.y);
  const zDiff = Math.abs(rz - cube.z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { x: rx, y: ry, z: rz };
}

/**
 * Converts cube coordinates to axial coordinates
 */
function cubeToAxial(cube: CubeCoord): HexLocation {
  return {
    col: cube.x,
    row: cube.z,
  };
}

/**
 * Converts axial coordinates to cube coordinates
 */
export function axialToCube(hex: { col: number; row: number }): CubeCoord {
  return {
    x: hex.col,
    z: hex.row,
    y: -hex.col - hex.row,
  };
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
 * Creates a pulse animation value based on time
 * @returns A value between 0 and 1 for the pulse effect
 */
export function getPulseAnimation(): number {
  const time = Date.now() / 1000;
  return (Math.sin(time * 3) + 1) / 2; // Oscillates between 0 and 1
}
