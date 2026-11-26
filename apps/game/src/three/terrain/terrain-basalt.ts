import { TERRAIN_HEX_CORNER_OFFSETS, snapTerrainCoordinate } from "./terrain-coordinates";
import { TERRAIN_GROUND_HEIGHT } from "./terrain-surface";

// Seven regular slabs per gameplay radius keep the pattern aligned across gameplay hexes.
export const BASALT_BLOCK_RADIUS = 1 / 7;
export const BASALT_SHELL_TRIANGLES = 4;
export const BASALT_SHELL_VERTICES = 6;
const UP = [0, 1, 0] as const;

type Point = { x: number; y: number; z: number };
type Triple = readonly [number, number, number];
type CellGeometry = { positions: number[]; normals: number[]; indices: number[]; colors: number[] };

/** A single shared, flat hex shell supplies both close and distant terrain. */
export function buildBasaltShell(): CellGeometry {
  const geometry: CellGeometry = { positions: [], normals: [], indices: [], colors: [] };
  const cap = TERRAIN_HEX_CORNER_OFFSETS.map((point) => ({
    x: snapTerrainCoordinate(point.x),
    z: snapTerrainCoordinate(point.z),
    y: TERRAIN_GROUND_HEIGHT,
  }));
  appendFace(geometry, cap, UP, [1, 1, 1]);
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
