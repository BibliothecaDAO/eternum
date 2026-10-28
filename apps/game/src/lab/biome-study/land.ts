import { BufferAttribute, BufferGeometry } from "three";

import { terrainHexToWorld, terrainNeighborCoordinates } from "@/three/terrain/terrain-coordinates";

import {
  BIOME_LOOKS,
  SURFACE_FAMILIES,
  SURFACE_FAMILY_COUNT,
  WATER_LEVEL,
  type FieldSample,
  type StudyCell,
  type StudyField,
  type SurfaceFamily,
  hexToLinear,
} from "./world-field";

/** A built land: its ground and water meshes and where a tile's model stands on it. */
export interface StudyLand {
  ground: BufferGeometry;
  water: BufferGeometry | null;
  standHeight(col: number, row: number): number;
}

/** How strongly a continuous land shows the tile levels and the landforms between them. */
export interface ReliefProfile {
  level: number;
  detail: number;
}

const GRID_SPACING = 0.12;
const TERRACE_STEP = 0.11;
const TERRACE_BEVEL = 0.035;
const TERRACE_SUBDIVISIONS = 6;
const TERRACE_DETAIL = 0.4;

/** One heightfield over the whole field: tile levels blend into each other through each biome's landforms. */
export function buildContinuousLand(field: StudyField, profile: ReliefProfile): StudyLand {
  // Only land is flattened: the sea keeps its depth, so the coast stays where the contract puts it.
  const heightOf = (sample: FieldSample) =>
    (sample.level > 0 ? sample.level * profile.level : sample.level) + (sample.height - sample.level) * profile.detail;
  const bounds = fieldBounds(field);
  const columns = Math.ceil((bounds.maxX - bounds.minX) / GRID_SPACING) + 1;
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / GRID_SPACING) + 1;
  const count = columns * rows;
  const heights = new Float32Array(count);
  const owned = new Uint8Array(count);
  const writer = new SurfaceWriter(count);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      const x = bounds.minX + column * GRID_SPACING;
      const z = bounds.minZ + row * GRID_SPACING;
      const sample = field.sample(x, z);
      heights[index] = heightOf(sample);
      owned[index] = sample.owner ? 1 : 0;
      writer.writeSurface(index, x, heights[index], z, sample.families, sample.tint, sample.moisture);
    }
  }
  writer.writeGridNormals(heights, columns, rows, GRID_SPACING);
  const triangles = gridTriangles(columns, rows, (a, b, c) => owned[a] + owned[b] + owned[c] > 0);
  return {
    ground: writer.toGeometry(triangles),
    water: buildWater(bounds, columns, rows, heights, owned),
    standHeight: (col, row) => {
      const center = terrainHexToWorld(col, row);
      return heightOf(field.sample(center.x, center.z));
    },
  };
}

/** Every tile its own plateau, stepped to its elevation, with rock walls down to lower neighbours. */
export function buildTerracedLand(field: StudyField): StudyLand {
  const cells = [...field.allCells()];
  const topOf = (cell: StudyCell) => Math.round(cell.level / TERRACE_STEP) * TERRACE_STEP;
  const perTile = 6 * (TERRACE_SUBDIVISIONS * TERRACE_SUBDIVISIONS) * 3 + 6 * 6;
  const writer = new SurfaceWriter(cells.length * perTile);
  let vertex = 0;
  const rockFamilies = familyVector({ rock: 1 });
  for (const cell of cells) {
    const top = topOf(cell);
    const families = familyVector(BIOME_LOOKS[cell.biome].families);
    const tint = hexToLinear(BIOME_LOOKS[cell.biome].tint);
    const surfaceAt = (x: number, z: number, rim: boolean) => {
      if (rim) return top - TERRACE_BEVEL;
      const sample = field.sample(x, z);
      return top + (sample.height - sample.level) * TERRACE_DETAIL;
    };
    for (const [x, z, rim] of terraceTopTriangles(cell)) {
      const y = surfaceAt(x, z, rim);
      const e = 0.04;
      const nx = rim ? 0 : surfaceAt(x - e, z, false) - surfaceAt(x + e, z, false);
      const nz = rim ? 0 : surfaceAt(x, z - e, false) - surfaceAt(x, z + e, false);
      writer.writeSurface(vertex, x, y, z, families, tint, cell.moisture);
      writer.writeNormal(vertex, nx, 2 * e, nz);
      vertex++;
    }
    const corners = hexCorners(cell);
    terrainNeighborCoordinates(cell.col, cell.row).forEach((coordinate) => {
      const neighbor = field.cell(coordinate.col, coordinate.row);
      const bottom = neighbor ? topOf(neighbor) - TERRACE_BEVEL : WATER_LEVEL - 0.5;
      if (bottom >= top - TERRACE_BEVEL) return;
      const [a, b] = edgeCorners(corners, cell, coordinate);
      const outward = [(a[0] + b[0]) / 2 - cell.x, (a[1] + b[1]) / 2 - cell.z];
      const wall: Array<[number, number, number]> = [
        [a[0], top - TERRACE_BEVEL, a[1]],
        [b[0], top - TERRACE_BEVEL, b[1]],
        [b[0], bottom, b[1]],
        [a[0], top - TERRACE_BEVEL, a[1]],
        [b[0], bottom, b[1]],
        [a[0], bottom, a[1]],
      ];
      for (const [x, y, z] of wall) {
        writer.writeSurface(vertex, x, y, z, rockFamilies, tint, cell.moisture);
        writer.writeNormal(vertex, outward[0], 0, outward[1]);
        vertex++;
      }
    });
  }
  const ground = writer.toGeometry(null, vertex);
  const bounds = fieldBounds(field);
  const columns = Math.ceil((bounds.maxX - bounds.minX) / GRID_SPACING) + 1;
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / GRID_SPACING) + 1;
  const heights = new Float32Array(columns * rows);
  const owned = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      const sample = field.sample(bounds.minX + column * GRID_SPACING, bounds.minZ + row * GRID_SPACING);
      heights[index] = sample.owner ? topOf(sample.owner) : 0;
      owned[index] = sample.owner ? 1 : 0;
    }
  }
  return {
    ground,
    water: buildWater(bounds, columns, rows, heights, owned),
    standHeight: (col, row) => {
      const cell = field.cell(col, row);
      if (!cell) return 0;
      const sample = field.sample(cell.x, cell.z);
      return topOf(cell) + (sample.height - sample.level) * TERRACE_DETAIL;
    },
  };
}

class SurfaceWriter {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly familiesA: Float32Array;
  readonly familiesB: Float32Array;
  readonly familiesC: Float32Array;
  readonly tints: Float32Array;

  constructor(count: number) {
    this.positions = new Float32Array(count * 3);
    this.normals = new Float32Array(count * 3);
    this.familiesA = new Float32Array(count * 4);
    this.familiesB = new Float32Array(count * 4);
    this.familiesC = new Float32Array(count * 4);
    this.tints = new Float32Array(count * 3);
  }

  writeSurface(
    index: number,
    x: number,
    y: number,
    z: number,
    families: ArrayLike<number>,
    tint: readonly [number, number, number],
    moisture: number,
  ): void {
    this.positions.set([x, y, z], index * 3);
    this.familiesA.set([families[0], families[1], families[2], families[3]], index * 4);
    this.familiesB.set([families[4], families[5], families[6], families[7]], index * 4);
    this.familiesC.set([families[8], moisture, families[9], 0], index * 4);
    this.tints.set(tint, index * 3);
  }

  writeNormal(index: number, x: number, y: number, z: number): void {
    const length = Math.hypot(x, y, z) || 1;
    this.normals.set([x / length, y / length, z / length], index * 3);
  }

  writeGridNormals(heights: Float32Array, columns: number, rows: number, spacing: number): void {
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const at = (c: number, r: number) =>
          heights[Math.min(rows - 1, Math.max(0, r)) * columns + Math.min(columns - 1, Math.max(0, c))];
        this.writeNormal(
          row * columns + column,
          at(column - 1, row) - at(column + 1, row),
          2 * spacing,
          at(column, row - 1) - at(column, row + 1),
        );
      }
    }
  }

  toGeometry(index: Uint32Array | null, vertexCount?: number): BufferGeometry {
    const geometry = new BufferGeometry();
    const slice = (array: Float32Array, size: number) =>
      vertexCount === undefined ? array : array.subarray(0, vertexCount * size);
    geometry.setAttribute("position", new BufferAttribute(slice(this.positions, 3), 3));
    geometry.setAttribute("normal", new BufferAttribute(slice(this.normals, 3), 3));
    geometry.setAttribute("familiesA", new BufferAttribute(slice(this.familiesA, 4), 4));
    geometry.setAttribute("familiesB", new BufferAttribute(slice(this.familiesB, 4), 4));
    geometry.setAttribute("familiesC", new BufferAttribute(slice(this.familiesC, 4), 4));
    geometry.setAttribute("tint", new BufferAttribute(slice(this.tints, 3), 3));
    if (index) geometry.setIndex(new BufferAttribute(index, 1));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }
}

interface FieldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function fieldBounds(field: StudyField): FieldBounds {
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const cell of field.allCells()) {
    bounds.minX = Math.min(bounds.minX, cell.x - 1);
    bounds.maxX = Math.max(bounds.maxX, cell.x + 1);
    bounds.minZ = Math.min(bounds.minZ, cell.z - 1.1);
    bounds.maxZ = Math.max(bounds.maxZ, cell.z + 1.1);
  }
  return bounds;
}

function gridTriangles(columns: number, rows: number, keep: (a: number, b: number, c: number) => boolean): Uint32Array {
  const indices: number[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      if (keep(a, c, b)) indices.push(a, c, b);
      if (keep(b, c, d)) indices.push(b, c, d);
    }
  }
  return Uint32Array.from(indices);
}

/** One water sheet at sea level wherever the ground dips below it, carrying its depth for colour and surf. */
function buildWater(
  bounds: FieldBounds,
  columns: number,
  rows: number,
  heights: Float32Array,
  owned: Uint8Array,
): BufferGeometry | null {
  const count = columns * rows;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const depths = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions.set([bounds.minX + column * GRID_SPACING, WATER_LEVEL, bounds.minZ + row * GRID_SPACING], index * 3);
    normals.set([0, 1, 0], index * 3);
    depths[index] = WATER_LEVEL - heights[index];
  }
  const indices = gridTriangles(
    columns,
    rows,
    (a, b, c) => owned[a] + owned[b] + owned[c] > 0 && Math.max(depths[a], depths[b], depths[c]) > 0,
  );
  if (indices.length === 0) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  geometry.setAttribute("waterDepth", new BufferAttribute(depths, 1));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** The hex top as six fans of a triangle lattice; vertices on the outer edge are flagged for the bevel. */
function terraceTopTriangles(cell: StudyCell): Array<[number, number, boolean]> {
  const corners = hexCorners(cell);
  const n = TERRACE_SUBDIVISIONS;
  const vertices: Array<[number, number, boolean]> = [];
  const point = (corner: number, i: number, j: number): [number, number, boolean] => {
    // i steps from the centre toward the edge, j along it.
    const a = corners[corner];
    const b = corners[(corner + 1) % 6];
    const u = i / n;
    const v = i === 0 ? 0 : j / i;
    const x = cell.x + (a[0] - cell.x + (b[0] - a[0]) * v) * u;
    const z = cell.z + (a[1] - cell.z + (b[1] - a[1]) * v) * u;
    return [x, z, i === n];
  };
  for (let corner = 0; corner < 6; corner++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        vertices.push(point(corner, i, j), point(corner, i + 1, j + 1), point(corner, i + 1, j));
        if (j < i) vertices.push(point(corner, i, j), point(corner, i, j + 1), point(corner, i + 1, j + 1));
      }
    }
  }
  return vertices;
}

function hexCorners(cell: StudyCell): Array<[number, number]> {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 6 + index * (Math.PI / 3);
    return [cell.x + Math.cos(angle), cell.z + Math.sin(angle)];
  });
}

/** The two corners of the hex edge facing a neighbour: the pair nearest the neighbour's centre. */
function edgeCorners(
  corners: Array<[number, number]>,
  cell: StudyCell,
  neighbor: { col: number; row: number },
): [[number, number], [number, number]] {
  const center = terrainHexToWorld(neighbor.col, neighbor.row);
  const ranked = corners.toSorted(
    (a, b) => Math.hypot(a[0] - center.x, a[1] - center.z) - Math.hypot(b[0] - center.x, b[1] - center.z),
  );
  const [first, second] = ranked;
  // Wind the wall so its face points away from this tile.
  const cross = (first[0] - cell.x) * (second[1] - cell.z) - (first[1] - cell.z) * (second[0] - cell.x);
  return cross > 0 ? [first, second] : [second, first];
}

function familyVector(families: Partial<Record<SurfaceFamily, number>>): Float32Array {
  const vector = new Float32Array(SURFACE_FAMILY_COUNT);
  for (const [family, share] of Object.entries(families))
    vector[SURFACE_FAMILIES.indexOf(family as SurfaceFamily)] = share;
  return vector;
}
