import { Box3, Color, Vector3 } from "three";

/**
 * A single segment of a path between two world positions
 */
export interface PathSegment {
  start: Vector3;
  end: Vector3;
  direction: Vector3;
  length: number;
}

/**
 * Display state affects opacity and animation
 */
export type PathDisplayState = "selected" | "hover" | "moving" | "preview";

/**
 * Complete path data for an army
 */
export interface ArmyPath {
  entityId: number;
  segments: PathSegment[];
  totalLength: number;

  // Rendering state
  displayState: PathDisplayState;
  progress: number; // 0-1, current position along path

  // Color from playerColorManager
  color: Color;

  // Cached bounds for culling
  boundingBox: Box3;

  // Instance buffer indices
  startIndex: number;
  segmentCount: number;
}

/**
 * Configuration for path rendering
 */
export interface PathRenderConfig {
  thickness: number; // Screen-space thickness in pixels
  dashScale: number; // Dashes per world unit
  flowSpeed: number; // Animation speed
  maxSegments: number; // Maximum total segments across all paths
}

/**
 * Default path render configuration
 */
export const DEFAULT_PATH_CONFIG: PathRenderConfig = {
  thickness: 4.0,
  dashScale: 8.0,
  flowSpeed: 2.0,
  maxSegments: 5000,
};

/**
 * Opacity values for different display states
 */
export const PATH_OPACITY: Record<PathDisplayState, number> = {
  selected: 0.8,
  hover: 0.4,
  moving: 0.6,
  preview: 0.3,
};

/**
 * Create path segments from an array of world positions
 */
export function createPathSegments(positions: Vector3[]): PathSegment[] {
  if (positions.length < 2) return [];

  const segments: PathSegment[] = [];

  for (let i = 0; i < positions.length - 1; i++) {
    const start = positions[i];
    const end = positions[i + 1];
    const direction = new Vector3().subVectors(end, start).normalize();
    const length = start.distanceTo(end);

    segments.push({ start, end, direction, length });
  }

  return segments;
}

/**
 * Calculate total length of path segments
 */
export function calculatePathLength(segments: PathSegment[]): number {
  return segments.reduce((sum, seg) => sum + seg.length, 0);
}

/**
 * Compute bounding box for path segments
 */
export function computePathBounds(segments: PathSegment[]): Box3 {
  const box = new Box3();

  for (const segment of segments) {
    box.expandByPoint(segment.start);
    box.expandByPoint(segment.end);
  }

  // Expand slightly to account for line thickness
  box.expandByScalar(0.5);

  return box;
}
