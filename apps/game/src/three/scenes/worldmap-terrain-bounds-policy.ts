import { worldHexToWorld } from "../world-origin";
import { Box3, Sphere, Vector3 } from "three";

import { getRenderBounds } from "../utils/chunk-geometry";

interface TerrainPresentationBoundsInput {
  startRow: number;
  startCol: number;
  renderSize: { width: number; height: number };
  chunkSize: number;
  /** Extra padding in hex units around the render bounds. Default: 2 */
  hexPadding?: number;
  /** Y-axis height range for 3D bounds. Default: [-1, 10] */
  heightRange?: [number, number];
}

interface TerrainPresentationBounds {
  /** Padded hex-space bounds */
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  /** Y-axis range for 3D frustum checks */
  minY: number;
  maxY: number;
}

const DEFAULT_HEX_PADDING = 2;
const DEFAULT_HEIGHT_RANGE: [number, number] = [-1, 10];
function getTerrainWorldPosition(col: number, row: number): Vector3 {
  const world = worldHexToWorld(col, row);
  return new Vector3(world.x, 0, world.z);
}

/**
 * Build conservative terrain presentation bounds by expanding the analytical
 * render bounds by the hex tile footprint plus an explicit padding margin.
 *
 * HEX_SIZE is 1, so each hex extends ~1 unit beyond its center. The total
 * expansion on each side is therefore: 1 (hex footprint) + hexPadding.
 */
export function resolveTerrainPresentationBounds(input: TerrainPresentationBoundsInput): TerrainPresentationBounds {
  const hexPadding = input.hexPadding ?? DEFAULT_HEX_PADDING;
  const heightRange = input.heightRange ?? DEFAULT_HEIGHT_RANGE;

  const rawBounds = getRenderBounds(input.startRow, input.startCol, input.renderSize, input.chunkSize);

  // Hex footprint (HEX_SIZE = 1) extends 1 unit beyond center in all directions.
  // Add the explicit hexPadding on top of that.
  const totalExpansion = 1 + Math.max(0, hexPadding);

  return {
    minCol: rawBounds.minCol - totalExpansion,
    maxCol: rawBounds.maxCol + totalExpansion,
    minRow: rawBounds.minRow - totalExpansion,
    maxRow: rawBounds.maxRow + totalExpansion,
    minY: heightRange[0],
    maxY: heightRange[1],
  };
}

/**
 * Check whether a hex is within the padded terrain presentation bounds.
 */
export function isHexWithinTerrainPresentationBounds(
  col: number,
  row: number,
  bounds: TerrainPresentationBounds,
): boolean {
  return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
}

export function resolveTerrainPresentationWorldBounds(input: TerrainPresentationBoundsInput): {
  box: Box3;
  sphere: Sphere;
} {
  const hexBounds = resolveTerrainPresentationBounds(input);
  const corners = [
    getTerrainWorldPosition(hexBounds.minCol, hexBounds.minRow),
    getTerrainWorldPosition(hexBounds.minCol, hexBounds.maxRow),
    getTerrainWorldPosition(hexBounds.maxCol, hexBounds.minRow),
    getTerrainWorldPosition(hexBounds.maxCol, hexBounds.maxRow),
  ];

  const box = new Box3().setFromPoints(corners);
  box.min.y = Math.min(box.min.y, hexBounds.minY);
  box.max.y = Math.max(box.max.y, hexBounds.maxY);

  const sphere = new Sphere();
  box.getBoundingSphere(sphere);

  return { box, sphere };
}
