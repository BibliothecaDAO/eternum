import { terrainHexCorners, terrainHexToWorld } from "./terrain-coordinates";

export const BASALT_SUPPORT_HEIGHT = 0.12;

// Seven regular slabs per gameplay radius keep the world lattice identical across reusable tiles.
export const BASALT_BLOCK_RADIUS = 1 / 7;
const BLOCK_RADIUS = BASALT_BLOCK_RADIUS;
export const BASALT_VARIANT_COUNT = 16;
export const BASALT_DETAIL_RADIUS = 5.8;
export const BASALT_DETAIL_CAMERA_HEIGHT = 14;
// Hexes whose centres can fall inside the detail radius, with one gameplay radius of margin for the sampling focus.
const HEX_AREA = (3 * Math.sqrt(3)) / 2;
export const BASALT_DETAIL_TILE_LIMIT = Math.ceil((Math.PI * (BASALT_DETAIL_RADIUS + 1) ** 2) / HEX_AREA);
export const BASALT_FAR_TRIANGLES = 16;
export const BASALT_FAR_VERTICES = 30;
const BLOCK_SPACING_X = Math.sqrt(3) * BLOCK_RADIUS;
const BLOCK_SPACING_Z = 1.5 * BLOCK_RADIUS;
const SLAB_RADIUS = BLOCK_RADIUS - 0.004;
const CAP_RADIUS = SLAB_RADIUS - 0.004;
const APOTHEM_FACTOR = Math.sqrt(3) / 2;
const JOINT_HEIGHT = 0.075;
const BEVEL_DEPTH = 0.004;
const EPSILON = 1e-10;
const UP = [0, 1, 0] as const;
const JOINT_COLOR = [0.017, 0.02, 0.026] as const;
const DIRECTIONS = Array.from({ length: 6 }, (_, index) => {
  const angle = Math.PI / 6 + (index * Math.PI) / 3;
  return { x: Math.cos(angle), z: Math.sin(angle) };
});
const FACE_NORMALS = Array.from({ length: 6 }, (_, index) => {
  const angle = (index * Math.PI) / 3;
  return { x: Math.cos(angle), z: Math.sin(angle) };
});

type Point = { x: number; y: number; z: number };
type Color = readonly [number, number, number];
type Normal = readonly [number, number, number];
type Block = { col: number; row: number; x: number; z: number };
type CellGeometry = { positions: number[]; normals: number[]; indices: number[]; colors: number[] };

/** Uses the same world-space lattice and bevel planes as the rendered mesh. */
export function sampleBasaltSurface(
  worldX: number,
  worldZ: number,
  occupied: boolean,
): { height: number; normal: Normal } {
  if (occupied) return { height: BASALT_SUPPORT_HEIGHT, normal: UP };

  const block = nearestBlock(worldX, worldZ);
  const face = nearestSlabFace(worldX - block.x, worldZ - block.z);
  const capHeight = blockHeight(block);
  if (face.distance <= CAP_RADIUS * APOTHEM_FACTOR + EPSILON) return { height: capHeight, normal: UP };
  if (face.distance > SLAB_RADIUS * APOTHEM_FACTOR + EPSILON) return { height: JOINT_HEIGHT, normal: UP };

  const bevelWidth = (SLAB_RADIUS - CAP_RADIUS) * APOTHEM_FACTOR;
  const bevelProgress = Math.min(1, (face.distance - CAP_RADIUS * APOTHEM_FACTOR) / bevelWidth);
  const slope = BEVEL_DEPTH / bevelWidth;
  const length = Math.hypot(slope, 1);
  return {
    height: capHeight - bevelProgress * BEVEL_DEPTH,
    normal: [(face.x * slope) / length, 1 / length, (face.z * slope) / length],
  };
}

export function basaltVariantForCell(col: number, row: number): number {
  const axialCol = 7 * (col - (row + Math.abs(row % 2)) / 2);
  return positiveModulo(axialCol, 4) + positiveModulo(7 * row, 4) * 4;
}

/** One of sixteen phase variants of the same continuous world-space height pattern. */
export function buildBasaltTemplate(variant: number, occupied: boolean): CellGeometry {
  const geometry: CellGeometry = { positions: [], normals: [], indices: [], colors: [] };
  const boundary = terrainHexCorners(0, 0);
  if (!occupied)
    appendFace(
      geometry,
      boundary.map((point) => ({ ...point, y: JOINT_HEIGHT })),
      UP,
      JOINT_COLOR,
    );

  for (const block of blocksInCell(0, 0)) {
    applyVariant(block, variant);
    appendBlock(geometry, block, boundary, occupied);
  }
  return geometry;
}

/** Distant relief is shaded on one closed hex shell rather than drawing every slab. */
export function buildBasaltFarTemplate(): CellGeometry {
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
      [start, { ...start, y: JOINT_HEIGHT }, { ...end, y: JOINT_HEIGHT }, end],
      [dz / length, 0, -dx / length],
      [0.55, 0.55, 0.55],
    );
  }
  return geometry;
}

function appendBlock(
  geometry: CellGeometry,
  block: Block,
  boundary: Array<{ x: number; z: number }>,
  occupied: boolean,
): void {
  const height = occupied ? BASALT_SUPPORT_HEIGHT : blockHeight(block);
  const color = blockColor(block);
  const cap = blockCorners(block, occupied ? SLAB_RADIUS : CAP_RADIUS, height);
  appendClippedFace(geometry, cap, boundary, UP, color);

  if (occupied) {
    // Coplanar, non-overlapping joints leave every landmark contact at the support height.
    appendRing(geometry, cap, blockCorners(block, BLOCK_RADIUS, height), boundary, UP, JOINT_COLOR);
    return;
  }

  const shoulder = blockCorners(block, SLAB_RADIUS, height - BEVEL_DEPTH);
  const foot = blockCorners(block, SLAB_RADIUS, JOINT_HEIGHT);
  appendRing(geometry, cap, shoulder, boundary, null, scaleColor(color, 0.82));
  appendRing(geometry, shoulder, foot, boundary, null, scaleColor(color, 0.55));
}

function appendRing(
  geometry: CellGeometry,
  inner: Point[],
  outer: Point[],
  boundary: Array<{ x: number; z: number }>,
  normal: Normal | null,
  color: Color,
): void {
  for (let index = 0; index < 6; index += 1) {
    const next = (index + 1) % 6;
    const face = [inner[index], outer[index], outer[next], inner[next]];
    appendClippedFace(geometry, face, boundary, normal ?? faceNormal(face), color);
  }
}

function appendClippedFace(
  geometry: CellGeometry,
  face: Point[],
  boundary: Array<{ x: number; z: number }>,
  normal: Normal,
  color: Color,
): void {
  let polygon = face;
  for (let edge = 0; edge < boundary.length && polygon.length > 0; edge += 1) {
    polygon = clipToEdge(polygon, boundary[edge], boundary[(edge + 1) % boundary.length]);
  }
  if (polygon.length < 3) return;
  if (normal[1] <= EPSILON && liesOnBoundary(polygon, boundary)) return;

  const previousIndexCount = geometry.indices.length;
  appendFace(geometry, polygon, normal, color);
  if (normal[1] > EPSILON && geometry.indices.length > previousIndexCount) {
    appendBoundaryClosures(geometry, polygon, boundary, scaleColor(color, 0.55));
  }
}

function appendBoundaryClosures(
  geometry: CellGeometry,
  polygon: Point[],
  boundary: Array<{ x: number; z: number }>,
  color: Color,
): void {
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (Math.hypot(end.x - start.x, end.z - start.z) < EPSILON) continue;
    for (let edge = 0; edge < boundary.length; edge += 1) {
      const boundaryStart = boundary[edge];
      const boundaryEnd = boundary[(edge + 1) % boundary.length];
      if (!isOnEdge(start, boundaryStart, boundaryEnd) || !isOnEdge(end, boundaryStart, boundaryEnd)) continue;

      // Close the exposed cut at a fog frontier without depending on neighboring tile state.
      // Adjacent cells have opposing outward faces, concealed below their shared surface.
      const dx = boundaryEnd.x - boundaryStart.x;
      const dz = boundaryEnd.z - boundaryStart.z;
      const length = Math.hypot(dx, dz);
      const wall = [start, { ...start, y: JOINT_HEIGHT }, { ...end, y: JOINT_HEIGHT }, end];
      appendFace(geometry, wall, [dz / length, 0, -dx / length], color);
      break;
    }
  }
}

function liesOnBoundary(polygon: Point[], boundary: Array<{ x: number; z: number }>): boolean {
  return boundary.some((start, index) =>
    polygon.every((point) => isOnEdge(point, start, boundary[(index + 1) % boundary.length])),
  );
}

function isOnEdge(point: Point, start: { x: number; z: number }, end: { x: number; z: number }): boolean {
  return Math.abs((end.x - start.x) * (point.z - start.z) - (end.z - start.z) * (point.x - start.x)) < EPSILON;
}

function clipToEdge(polygon: Point[], start: { x: number; z: number }, end: { x: number; z: number }): Point[] {
  const result: Point[] = [];
  const distance = (point: Point) => (end.x - start.x) * (point.z - start.z) - (end.z - start.z) * (point.x - start.x);
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentDistance = distance(current);
    const previousDistance = distance(previous);
    const currentInside = currentDistance >= 0;
    const previousInside = previousDistance >= 0;
    if (currentInside !== previousInside) {
      const fraction = previousDistance / (previousDistance - currentDistance);
      result.push({
        x: previous.x + (current.x - previous.x) * fraction,
        y: previous.y + (current.y - previous.y) * fraction,
        z: previous.z + (current.z - previous.z) * fraction,
      });
    }
    if (currentInside) result.push(current);
  }
  return result;
}

function appendFace(geometry: CellGeometry, polygon: Point[], normal: Normal, color: Color): void {
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
    const cross = triangleCross(a, b, c);
    if (Math.hypot(...cross) < EPSILON) continue;
    const aligned = cross[0] * normal[0] + cross[1] * normal[1] + cross[2] * normal[2] > 0;
    geometry.indices.push(offset, offset + (aligned ? index : index + 1), offset + (aligned ? index + 1 : index));
  }
}

function blocksInCell(col: number, row: number): Block[] {
  const center = terrainHexToWorld(col, row);
  const blocks: Block[] = [];
  const firstRow = Math.floor((center.z - 1 - BLOCK_RADIUS) / BLOCK_SPACING_Z);
  const lastRow = Math.ceil((center.z + 1 + BLOCK_RADIUS) / BLOCK_SPACING_Z);
  for (let blockRow = firstRow; blockRow <= lastRow; blockRow += 1) {
    const firstCol = Math.floor((center.x - 1 - BLOCK_RADIUS) / BLOCK_SPACING_X - blockRow / 2);
    const lastCol = Math.ceil((center.x + 1 + BLOCK_RADIUS) / BLOCK_SPACING_X - blockRow / 2);
    for (let blockCol = firstCol; blockCol <= lastCol; blockCol += 1) {
      const block = latticeBlock(blockCol, blockRow);
      if (nearestSlabFace(block.x - center.x, block.z - center.z).distance <= APOTHEM_FACTOR + BLOCK_RADIUS) {
        blocks.push(block);
      }
    }
  }
  return blocks;
}

function nearestBlock(x: number, z: number): Block {
  const axialRow = z / BLOCK_SPACING_Z;
  const axialCol = x / BLOCK_SPACING_X - axialRow / 2;
  const axialThird = -axialCol - axialRow;
  let col = Math.round(axialCol);
  let row = Math.round(axialRow);
  const third = Math.round(axialThird);
  const colError = Math.abs(col - axialCol);
  const rowError = Math.abs(row - axialRow);
  const thirdError = Math.abs(third - axialThird);
  if (colError > rowError && colError > thirdError) col = -row - third;
  else if (rowError > thirdError) row = -col - third;
  return latticeBlock(col, row);
}

function latticeBlock(col: number, row: number): Block {
  return { col, row, x: BLOCK_SPACING_X * (col + row / 2), z: BLOCK_SPACING_Z * row };
}

function blockCorners(block: Block, radius: number, y: number): Point[] {
  return DIRECTIONS.map((direction) => ({ x: block.x + direction.x * radius, y, z: block.z + direction.z * radius }));
}

function nearestSlabFace(x: number, z: number): { distance: number; x: number; z: number } {
  let result = { distance: -Infinity, x: 0, z: 0 };
  for (const normal of FACE_NORMALS) {
    const distance = x * normal.x + z * normal.z;
    if (distance > result.distance) result = { ...normal, distance };
  }
  return result;
}

function applyVariant(block: Block, variant: number): void {
  block.col += variant % 4;
  block.row += Math.floor(variant / 4);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

const HEIGHT_HASH_SALT = 0;
const COLOR_HASH_SALT = 1;

/** Deterministic per-block noise on the 4×4 lattice; the salt decorrelates height from colour. */
function blockHash(block: Block, salt: number): number {
  const col = positiveModulo(block.col, 4);
  const row = positiveModulo(block.row, 4);
  return ((col * 73 + row * 151 + col * row * 17 + salt * (col * 41 + row * 67)) % 251) / 251;
}

function blockHeight(block: Block): number {
  return 0.09 + blockHash(block, HEIGHT_HASH_SALT) * 0.04;
}

function blockColor(block: Block): Color {
  const brightness = 0.85 + blockHash(block, COLOR_HASH_SALT) * 0.3;
  return scaleColor([0.035, 0.04, 0.049], brightness);
}

function scaleColor(color: Color, scale: number): Color {
  return [color[0] * scale, color[1] * scale, color[2] * scale];
}

function triangleCross(a: Point, b: Point, c: Point): Normal {
  return [
    (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y),
    (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z),
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
  ];
}

function faceNormal(face: Point[]): Normal {
  const cross = triangleCross(face[0], face[2], face[1]);
  const length = Math.hypot(...cross);
  return [cross[0] / length, cross[1] / length, cross[2] / length];
}
