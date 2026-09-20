import { terrainHexCorners } from "./terrain-coordinates";

export const BASALT_SUPPORT_HEIGHT = 0.12;
// Seven regular slabs per gameplay radius keep the pattern aligned across gameplay hexes.
export const BASALT_BLOCK_RADIUS = 1 / 7;
export const BASALT_SHELL_TRIANGLES = 16;
export const BASALT_SHELL_VERTICES = 30;
const SHELL_BOTTOM = 0.075;
const UP = [0, 1, 0] as const;

type Point = { x: number; y: number; z: number };
type Triple = readonly [number, number, number];
type CellGeometry = { positions: number[]; normals: number[]; indices: number[]; colors: number[] };

/** Slab gaps are surface color only: every tile supports landmarks at the same height. */
export function sampleBasaltSurface(): { height: number; normal: Triple } {
  return { height: BASALT_SUPPORT_HEIGHT, normal: UP };
}

/** A single shared, flat hex shell supplies both close and distant terrain. */
export function buildBasaltShell(): CellGeometry {
  const geometry: CellGeometry = { positions: [], normals: [], indices: [], colors: [] };
  const cap = terrainHexCorners(0, 0).map((point) => ({ ...point, y: BASALT_SUPPORT_HEIGHT }));
  appendFace(geometry, cap, UP, [1, 1, 1]);
  for (let edge = 0; edge < 6; edge += 1) {
    const start = cap[edge];
    const end = cap[(edge + 1) % 6];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    appendFace(
      geometry,
      [start, { ...start, y: SHELL_BOTTOM }, { ...end, y: SHELL_BOTTOM }, end],
      [dz / length, 0, -dx / length],
      [0.55, 0.55, 0.55],
    );
  }
  return geometry;
}

function appendFace(geometry: CellGeometry, polygon: Point[], normal: Triple, color: Triple): void {
  const offset = geometry.positions.length / 3;
  for (const point of polygon) {
    geometry.positions.push(point.x, point.y, point.z);
    geometry.normals.push(...normal);
    geometry.colors.push(...color);
  }
  for (let index = 1; index < polygon.length - 1; index += 1) {
    const a = polygon[0];
    const b = polygon[index];
    const c = polygon[index + 1];
    const cross = [
      (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y),
      (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z),
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
    ];
    const aligned = cross[0] * normal[0] + cross[1] * normal[1] + cross[2] * normal[2] > 0;
    geometry.indices.push(offset, offset + (aligned ? index : index + 1), offset + (aligned ? index + 1 : index));
  }
}
