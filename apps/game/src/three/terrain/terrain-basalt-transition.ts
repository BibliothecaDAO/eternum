import { BASALT_BLOCK_RADIUS, BASALT_SUPPORT_HEIGHT } from "./terrain-basalt";
import {
  findNearestTerrainHex,
  terrainCellKey,
  terrainHexCorners,
  terrainHexToWorld,
  terrainNeighborCoordinates,
  snapTerrainCoordinate,
  type TerrainWorldCoordinate,
} from "./terrain-coordinates";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";

const APOTHEM = Math.sqrt(3) / 2;
const SPACING_X = Math.sqrt(3) * BASALT_BLOCK_RADIUS;
const SPACING_Z = 1.5 * BASALT_BLOCK_RADIUS;

/** Surface-only mineral margins use revealed spires, never hidden biome or landmark data. */
export class SurfaceBasaltTransition {
  private readonly centersByCell = new Map<string, TerrainWorldCoordinate[]>();

  constructor(request: TerrainPageRequest) {
    if (request.surfacePresentation === "ethereal") return;
    const cells = new Map(
      [...request.halo, ...request.cells].map((cell) => [terrainCellKey(cell.col, cell.row), cell]),
    );
    for (const cell of cells.values()) {
      if (!cell.explored || !cell.biome || cell.surfacePresentation !== "ethereal") continue;
      const center = terrainHexToWorld(cell.col, cell.row);
      for (const coordinate of [cell, ...terrainNeighborCoordinates(cell.col, cell.row)]) {
        const key = terrainCellKey(coordinate.col, coordinate.row);
        const centers = this.centersByCell.get(key) ?? [];
        centers.push(center);
        this.centersByCell.set(key, centers);
      }
    }
  }

  affects(cell: Pick<TerrainCellInput, "col" | "row">): boolean {
    return this.centersByCell.has(terrainCellKey(cell.col, cell.row));
  }

  blendHeight(x: number, z: number, height: number): number {
    if (this.centersByCell.size === 0) return height;
    const distance = this.distanceFromPatch(x, z, findNearestTerrainHex(x, z));
    // Complete the first ring at the same height, then join the existing landform gently.
    const weight = 1 - smoothstep(0.16, 0.62, distance);
    return height + (BASALT_SUPPORT_HEIGHT - height) * weight;
  }

  slabWeight(x: number, z: number, cell: Pick<TerrainCellInput, "col" | "row">): number {
    const distance = this.distanceFromPatch(x, z, cell);
    const col = Math.round(x / SPACING_X - z / SPACING_Z / 2);
    const row = Math.round(z / SPACING_Z);
    const variation = ((((col * 73 + row * 151 + col * row * 17) % 251) + 251) % 251) / 251;
    return 1 - smoothstep(0.13, 0.29 + variation * 0.19, distance);
  }

  private distanceFromPatch(x: number, z: number, cell: Pick<TerrainCellInput, "col" | "row">): number {
    let distance = Infinity;
    for (const center of this.centersByCell.get(terrainCellKey(cell.col, cell.row)) ?? []) {
      const dx = Math.abs(x - center.x),
        dz = Math.abs(z - center.z);
      distance = Math.min(distance, Math.max(dx, dx * 0.5 + dz * APOTHEM) - APOTHEM);
    }
    return distance;
  }
}

/** Partition a gameplay hex by the world slab lattice so no material boundary cuts a slab. */
export function visitSurfaceBasaltSlabs(
  cell: Pick<TerrainCellInput, "col" | "row">,
  visit: (polygon: TerrainWorldCoordinate[], center: TerrainWorldCoordinate) => void,
  subdivisions = 3,
): void {
  const center = terrainHexToWorld(cell.col, cell.row);
  const boundary = terrainHexCorners(cell.col, cell.row);
  for (let row = Math.floor((center.z - 1.2) / SPACING_Z); row <= Math.ceil((center.z + 1.2) / SPACING_Z); row++) {
    for (
      let col = Math.floor((center.x - 1.2) / SPACING_X - row / 2);
      col <= Math.ceil((center.x + 1.2) / SPACING_X - row / 2);
      col++
    ) {
      const slab = { x: SPACING_X * (col + row / 2), z: SPACING_Z * row };
      let polygon = Array.from({ length: 6 }, (_, edge) => ({
        x: slab.x + Math.cos(Math.PI / 6 + (edge * Math.PI) / 3) * BASALT_BLOCK_RADIUS,
        z: slab.z + Math.sin(Math.PI / 6 + (edge * Math.PI) / 3) * BASALT_BLOCK_RADIUS,
      }));
      for (let edge = 0; edge < 6 && polygon.length; edge++)
        polygon = clipPolygon(polygon, boundary[edge], boundary[(edge + 1) % 6]);
      if (polygon.length >= 3)
        visit(
          insertBoundaryVertices(polygon, boundary, subdivisions).map((p) => ({
            x: snapTerrainCoordinate(p.x),
            z: snapTerrainCoordinate(p.z),
          })),
          slab,
        );
    }
  }
}

/** Preserve both sides' edge vertices, including ordinary terrain's subdivision breakpoints. */
function insertBoundaryVertices(
  polygon: TerrainWorldCoordinate[],
  boundary: TerrainWorldCoordinate[],
  subdivisions: number,
): TerrainWorldCoordinate[] {
  const result: TerrainWorldCoordinate[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const start = polygon[i],
      end = polygon[(i + 1) % polygon.length];
    result.push(start);
    const dx = end.x - start.x,
      dz = end.z - start.z;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared < 1e-12) continue;
    const points: Array<{ point: TerrainWorldCoordinate; t: number }> = [];
    for (let edge = 0; edge < 6; edge++) {
      const a = boundary[edge],
        b = boundary[(edge + 1) % 6];
      for (let step = 1; step < subdivisions; step++) {
        const point = { x: a.x + ((b.x - a.x) * step) / subdivisions, z: a.z + ((b.z - a.z) * step) / subdivisions };
        if (Math.abs(dx * (point.z - start.z) - dz * (point.x - start.x)) > 1e-9) continue;
        const t = ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared;
        if (t > 1e-6 && t < 1 - 1e-6) points.push({ point, t });
      }
    }
    for (const entry of points.sort((a, b) => a.t - b.t)) result.push(entry.point);
  }
  return result;
}

function clipPolygon(
  polygon: TerrainWorldCoordinate[],
  start: TerrainWorldCoordinate,
  end: TerrainWorldCoordinate,
): TerrainWorldCoordinate[] {
  const result: TerrainWorldCoordinate[] = [];
  const distance = (p: TerrainWorldCoordinate) =>
    (end.x - start.x) * (p.z - start.z) - (end.z - start.z) * (p.x - start.x);
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[(i + polygon.length - 1) % polygon.length],
      b = polygon[i];
    const da = distance(a),
      db = distance(b);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
    if (db >= 0) result.push(b);
  }
  return result;
}

function smoothstep(low: number, high: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}
