import {
  terrainHexCorners,
  terrainHexToWorld,
  terrainNeighborCoordinates,
  snapTerrainCoordinate,
  type TerrainWorldCoordinate,
} from "./terrain-coordinates";
import { TerrainField, type TerrainVisualSample } from "./terrain-field";
import { PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER, prepareTerrainPropInstances } from "./terrain-props";
import { prepareTerrainShroudInstances } from "./terrain-shroud";
import type {
  PreparedTerrainPage,
  TerrainCellInput,
  TerrainGeometryBuffers,
  TerrainPageRequest,
} from "./terrain-types";
import { PROCEDURAL_TERRAIN_STYLE_VERSION, getTerrainGeometryBufferViews } from "./terrain-types";
import { isTerrainWaterBiome, TERRAIN_WATER_LEVEL } from "./terrain-water";

interface GeometryAccumulator {
  biomeIds: number[];
  colors: number[];
  explored: number[];
  groundWeights0: number[];
  groundWeights1: number[];
  heights: number[];
  indices: number[];
  normals: number[];
  positions: number[];
  roughness: number[];
  shore: number[];
  uvs: number[];
}

class TerrainVertexSampler {
  exploredSamples = 0;
  private readonly exploredByCoordinate = new Map<string, TerrainVisualSample>();

  constructor(private readonly field: TerrainField) {}

  sample(cell: TerrainCellInput, point: TerrainWorldCoordinate): TerrainVisualSample {
    if (!cell.explored) return this.field.sampleFogPreviewVertex(point.x, point.z, cell);
    const key = `${point.x}:${point.z}`;
    const retained = this.exploredByCoordinate.get(key);
    if (retained) return retained;
    const sample = this.field.sampleVertex(point.x, point.z, cell);
    this.exploredByCoordinate.set(key, sample);
    this.exploredSamples += 1;
    return sample;
  }
}

const DEFAULT_SUBDIVISIONS = 3;
const FRONTIER_SKIRT_DEPTH = 0.24;

export function prepareTerrainPage(request: TerrainPageRequest): PreparedTerrainPage {
  const startedAt = performance.now();
  const subdivisions = resolveSubdivisions(request.subdivisions);
  const field = new TerrainField(request);
  const vertexSampler = new TerrainVertexSampler(field);
  const land = createGeometryAccumulator();
  const water = createGeometryAccumulator();
  let fogTerrainCells = 0;
  let frontierEdges = 0;
  let frontierPreviewCells = 0;

  for (const cell of canonicalCells(request.cells)) {
    if (cell.explored && cell.biome) {
      appendCellPatch(land, vertexSampler, cell, subdivisions);
      if (isTerrainWaterBiome(cell.biome)) appendWaterCellPatch(water, vertexSampler, cell, subdivisions);
      frontierEdges += appendFrontierSkirts(land, field, cell);
      continue;
    }
    appendCellPatch(land, vertexSampler, cell, subdivisions);
    const previewBiome = field.getFogPreviewBiome(cell.col, cell.row);
    if (previewBiome && isTerrainWaterBiome(previewBiome)) {
      appendWaterCellPatch(water, vertexSampler, cell, subdivisions);
    }
    fogTerrainCells += 1;
    if (field.isFrontierCell(cell.col, cell.row)) frontierPreviewCells += 1;
  }

  const buffers = finalizeGeometry(land);
  const waterBuffers = water.positions.length > 0 ? finalizeGeometry(water) : null;
  const propInstances = prepareTerrainPropInstances(request, field);
  const shroudInstances = prepareTerrainShroudInstances(request, field);
  const geometryBytes = countGeometryBytes(buffers) + (waterBuffers ? countGeometryBytes(waterBuffers) : 0);
  const prepareMs = performance.now() - startedAt;
  const fingerprint = fingerprintPreparedPage(request, buffers, waterBuffers, propInstances, shroudInstances);

  return {
    buffers,
    diagnostics: {
      biomeMismatchCount: field.getBiomeMismatchCount(),
      exploredSurfaceSamples: vertexSampler.exploredSamples,
      fogTerrainCells,
      frontierEdges,
      frontierPreviewCells,
      geometryBytes,
      prepareMs,
      shroudInstances: shroudInstances.length,
      triangles: (buffers.indices.length + (waterBuffers?.indices.length ?? 0)) / 3,
      vertices: (buffers.positions.length + (waterBuffers?.positions.length ?? 0)) / 3,
    },
    fingerprint,
    propInstances,
    request,
    shroudInstances,
    waterBuffers,
  };
}

function appendWaterCellPatch(
  target: GeometryAccumulator,
  vertexSampler: TerrainVertexSampler,
  cell: TerrainCellInput,
  subdivisions: number,
): void {
  const center = terrainHexToWorld(cell.col, cell.row);
  const corners = terrainHexCorners(cell.col, cell.row);
  for (let wedge = 0; wedge < 6; wedge += 1) {
    appendSubdividedTriangle(target, center, corners[wedge], corners[(wedge + 1) % 6], subdivisions, (point) => ({
      ...vertexSampler.sample(cell, point),
      height: TERRAIN_WATER_LEVEL,
      normal: [0, 1, 0],
      roughness: 0.24,
      uvOffset: [0, 0],
    }));
  }
}

function appendCellPatch(
  target: GeometryAccumulator,
  vertexSampler: TerrainVertexSampler,
  cell: TerrainCellInput,
  subdivisions: number,
): void {
  const center = terrainHexToWorld(cell.col, cell.row);
  const corners = terrainHexCorners(cell.col, cell.row);
  for (let wedge = 0; wedge < 6; wedge += 1) {
    appendSubdividedTriangle(target, center, corners[wedge], corners[(wedge + 1) % 6], subdivisions, (point) =>
      vertexSampler.sample(cell, point),
    );
  }
}

function appendSubdividedTriangle(
  target: GeometryAccumulator,
  center: TerrainWorldCoordinate,
  cornerA: TerrainWorldCoordinate,
  cornerB: TerrainWorldCoordinate,
  subdivisions: number,
  samplePoint: (point: TerrainWorldCoordinate) => TerrainVisualSample,
): void {
  const rowStarts: number[] = [];
  for (let row = 0; row <= subdivisions; row += 1) {
    rowStarts.push(target.positions.length / 3);
    for (let column = 0; column <= subdivisions - row; column += 1) {
      const weightA = row / subdivisions;
      const weightB = column / subdivisions;
      const point = {
        x: snapTerrainCoordinate(center.x + (cornerA.x - center.x) * weightA + (cornerB.x - center.x) * weightB),
        z: snapTerrainCoordinate(center.z + (cornerA.z - center.z) * weightA + (cornerB.z - center.z) * weightB),
      };
      appendVertex(target, point, samplePoint(point));
    }
  }

  for (let row = 0; row < subdivisions; row += 1) {
    const columns = subdivisions - row;
    for (let column = 0; column < columns; column += 1) {
      const centerIndex = rowStarts[row] + column;
      const towardA = rowStarts[row + 1] + column;
      const towardB = rowStarts[row] + column + 1;
      target.indices.push(centerIndex, towardB, towardA);
      if (column < columns - 1) {
        const diagonal = rowStarts[row + 1] + column + 1;
        target.indices.push(towardA, towardB, diagonal);
      }
    }
  }
}

function appendFrontierSkirts(target: GeometryAccumulator, field: TerrainField, cell: TerrainCellInput): number {
  const corners = terrainHexCorners(cell.col, cell.row);
  const neighbors = terrainNeighborCoordinates(cell.col, cell.row);
  let edgeCount = 0;

  neighbors.forEach((neighbor, direction) => {
    if (field.getCell(neighbor.col, neighbor.row)?.explored || field.isFrontierCell(neighbor.col, neighbor.row)) return;
    const start = corners[(direction + 5) % 6];
    const end = corners[direction];
    const startSample = field.sampleVertex(start.x, start.z);
    const endSample = field.sampleVertex(end.x, end.z);
    const topStart = appendFrontierVertex(target, start, startSample, startSample.height, false);
    const topEnd = appendFrontierVertex(target, end, endSample, endSample.height, false);
    const bottomStart = appendFrontierVertex(
      target,
      start,
      startSample,
      startSample.height - FRONTIER_SKIRT_DEPTH,
      true,
    );
    const bottomEnd = appendFrontierVertex(target, end, endSample, endSample.height - FRONTIER_SKIRT_DEPTH, true);
    target.indices.push(topStart, topEnd, bottomStart, bottomStart, topEnd, bottomEnd);
    edgeCount += 1;
  });

  return edgeCount;
}

function appendFrontierVertex(
  target: GeometryAccumulator,
  point: TerrainWorldCoordinate,
  source: TerrainVisualSample,
  height: number,
  darken: boolean,
): number {
  return appendVertex(target, point, {
    ...source,
    color: darken ? [source.color[0] * 0.3, source.color[1] * 0.3, source.color[2] * 0.3] : source.color,
    height,
    roughness: 1,
  });
}

function appendVertex(target: GeometryAccumulator, point: TerrainWorldCoordinate, sample: TerrainVisualSample): number {
  const index = target.positions.length / 3;
  target.positions.push(point.x, sample.height, point.z);
  target.uvs.push(point.x + sample.uvOffset[0], point.z + sample.uvOffset[1]);
  target.normals.push(...sample.normal);
  target.colors.push(...sample.color);
  target.roughness.push(sample.roughness);
  target.shore.push(sample.shore);
  target.biomeIds.push(sample.biomeId);
  target.explored.push(sample.explored);
  const groundWeights = quantizeGroundWeights(sample.groundWeights);
  target.groundWeights0.push(...groundWeights.slice(0, 4));
  target.groundWeights1.push(...groundWeights.slice(4, 8));
  target.heights.push(sample.height);
  return index;
}

function createGeometryAccumulator(): GeometryAccumulator {
  return {
    biomeIds: [],
    colors: [],
    explored: [],
    groundWeights0: [],
    groundWeights1: [],
    heights: [],
    indices: [],
    normals: [],
    positions: [],
    roughness: [],
    shore: [],
    uvs: [],
  };
}

function finalizeGeometry(source: GeometryAccumulator): TerrainGeometryBuffers {
  const positions = new Float32Array(source.positions);
  return {
    biomeIds: new Float32Array(source.biomeIds),
    bounds: resolveGeometryBounds(positions),
    colors: new Float32Array(source.colors),
    explored: new Float32Array(source.explored),
    groundWeights0: new Uint8Array(source.groundWeights0),
    groundWeights1: new Uint8Array(source.groundWeights1),
    heights: new Float32Array(source.heights),
    indices: new Uint32Array(source.indices),
    normals: new Float32Array(source.normals),
    positions,
    roughness: new Float32Array(source.roughness),
    shore: new Float32Array(source.shore),
    uvs: new Float32Array(source.uvs),
  };
}

function resolveGeometryBounds(positions: ArrayLike<number>): TerrainGeometryBuffers["bounds"] {
  if (positions.length === 0) {
    return { boxMax: [0, 0, 0], boxMin: [0, 0, 0], sphereCenter: [0, 0, 0], sphereRadius: 0 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < positions.length; index += 3) {
    minX = Math.min(minX, positions[index]);
    minY = Math.min(minY, positions[index + 1]);
    minZ = Math.min(minZ, positions[index + 2]);
    maxX = Math.max(maxX, positions[index]);
    maxY = Math.max(maxY, positions[index + 1]);
    maxZ = Math.max(maxZ, positions[index + 2]);
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  let radiusSquared = 0;
  for (let index = 0; index < positions.length; index += 3) {
    radiusSquared = Math.max(
      radiusSquared,
      (positions[index] - centerX) ** 2 + (positions[index + 1] - centerY) ** 2 + (positions[index + 2] - centerZ) ** 2,
    );
  }
  return {
    boxMax: [maxX, maxY, maxZ],
    boxMin: [minX, minY, minZ],
    sphereCenter: [centerX, centerY, centerZ],
    sphereRadius: Math.sqrt(radiusSquared),
  };
}

function quantizeGroundWeights(weights: TerrainVisualSample["groundWeights"]): number[] {
  const scaled = weights.map((weight) => Math.max(0, weight) * 255);
  const quantized = scaled.map(Math.floor);
  const remaining = 255 - quantized.reduce((total, weight) => total + weight, 0);
  const allocationOrder = scaled
    .map((weight, index) => ({ fraction: weight - quantized[index], index }))
    .toSorted((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; index < remaining; index += 1) {
    quantized[allocationOrder[index].index] += 1;
  }
  return quantized;
}

function canonicalCells(cells: readonly TerrainCellInput[]): TerrainCellInput[] {
  return cells.toSorted((left, right) => left.row - right.row || left.col - right.col);
}

function resolveSubdivisions(value: number | undefined): number {
  const subdivisions = value ?? DEFAULT_SUBDIVISIONS;
  if (!Number.isInteger(subdivisions) || subdivisions < 1 || subdivisions > 4) {
    throw new Error(`Terrain subdivisions must be an integer from 1 to 4, received ${String(value)}`);
  }
  return subdivisions;
}

function countGeometryBytes(buffers: TerrainGeometryBuffers): number {
  return getTerrainGeometryBufferViews(buffers).reduce((total, buffer) => total + buffer.byteLength, 0);
}

function fingerprintPreparedPage(
  request: TerrainPageRequest,
  land: TerrainGeometryBuffers,
  water: TerrainGeometryBuffers | null,
  props: PreparedTerrainPage["propInstances"],
  shroud: PreparedTerrainPage["shroudInstances"],
): string {
  let hash = hashString(
    JSON.stringify({
      cells: canonicalCells(request.cells),
      climate: request.climate,
      halo: canonicalCells(request.halo),
      mapCenter: request.mapCenter,
      pageKey: request.pageKey,
      props,
      propDensityMultiplier: request.propDensityMultiplier ?? PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER,
      shroud,
      subdivisions: request.subdivisions ?? DEFAULT_SUBDIVISIONS,
      styleVersion: PROCEDURAL_TERRAIN_STYLE_VERSION,
    }),
  );
  hash = hashGeometry(land, hash);
  if (water) hash = hashGeometry(water, hash);
  return hash.toString(16).padStart(8, "0");
}

function hashGeometry(buffers: TerrainGeometryBuffers, initialHash: number): number {
  let hash = initialHash;
  for (const buffer of getTerrainGeometryBufferViews(buffers)) {
    const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash;
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash;
}
