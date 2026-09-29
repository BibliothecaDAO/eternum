import type { HexPosition } from "@bibliothecadao/types";
import { latticeHexAt, latticeHexBoundsForWorldRect, latticeToWorld } from "./utils/hex-lattice";

/**
 * The world map's floating origin, in normalized hexes. Every world-map hex is drawn at (hex − origin) on the lattice,
 * so float32 positions on the GPU, 16-bit cell keys and minimap pixels stay small wherever the map is looked at:
 * a Frontier site sits about 2^31 hexes from the map centre. Hexes everywhere else (facts, keys, URLs, commands)
 * never see the origin. Blitz and Eternum maps fit inside the reach of origin 0, so it never moves for them.
 */
let origin: HexPosition = { col: 0, row: 0 };

/** The terrain and basalt shader lattices repeat every two rows; a coarser grid keeps them aligned and tidy. */
const ORIGIN_GRID = 64;
/** How far a world-map hex may sit from the origin: keeps world values well inside float32 and cell keys in range. */
const WORLD_ORIGIN_REACH = 8192;

export const worldOrigin = (): HexPosition => origin;

export function setWorldOrigin(hex: HexPosition): void {
  origin = {
    col: Math.round(hex.col / ORIGIN_GRID) * ORIGIN_GRID,
    row: Math.round(hex.row / ORIGIN_GRID) * ORIGIN_GRID,
  };
}

export const isWithinWorldOriginReach = (hex: HexPosition): boolean =>
  Math.abs(hex.col - origin.col) <= WORLD_ORIGIN_REACH && Math.abs(hex.row - origin.row) <= WORLD_ORIGIN_REACH;

export const toRenderHex = (col: number, row: number): HexPosition => ({
  col: col - origin.col,
  row: row - origin.row,
});

export const fromRenderHex = (col: number, row: number): HexPosition => ({
  col: col + origin.col,
  row: row + origin.row,
});

/** Where a normalized world-map hex is drawn. */
export function worldHexToWorld(col: number, row: number): { x: number; z: number } {
  const render = toRenderHex(col, row);
  return latticeToWorld(render.col, render.row);
}

/** The normalized world-map hex under a drawn world point. */
export function worldHexAt(worldX: number, worldZ: number): HexPosition {
  const render = latticeHexAt(worldX, worldZ);
  return fromRenderHex(render.col, render.row);
}

/** Normalized world-map hexes that can touch a drawn world rectangle. */
export function worldHexBoundsForRect(rect: { minX: number; minZ: number; maxX: number; maxZ: number }) {
  const bounds = latticeHexBoundsForWorldRect(rect);
  return {
    minCol: bounds.minCol + origin.col,
    minRow: bounds.minRow + origin.row,
    maxCol: bounds.maxCol + origin.col,
    maxRow: bounds.maxRow + origin.row,
  };
}
