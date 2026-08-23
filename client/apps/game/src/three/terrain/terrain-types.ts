import type { BiomeClimateConfig } from "@bibliothecadao/eternum";
import type { BiomeType } from "@bibliothecadao/types";
import type { TerrainPropArchetypeId } from "./terrain-prop-catalog";

export const PROCEDURAL_TERRAIN_STYLE_VERSION = 7;

export interface TerrainCellInput {
  biome: BiomeType | null;
  col: number;
  explored: boolean;
  occupied: boolean;
  row: number;
}

export interface TerrainPageRequest {
  cells: readonly TerrainCellInput[];
  climate: BiomeClimateConfig;
  generation: number;
  halo: readonly TerrainCellInput[];
  mapCenter: number;
  pageKey: string;
  propDensityMultiplier?: number;
  strictBiomeParity?: boolean;
  subdivisions?: number;
}

export interface TerrainSurfaceSample {
  biome: BiomeType | null;
  height: number;
  normal: readonly [number, number, number];
}

export interface TerrainGeometryBuffers {
  biomeIds: Float32Array;
  bounds: TerrainGeometryBounds;
  colors: Float32Array;
  explored: Float32Array;
  groundWeights0: Uint8Array;
  groundWeights1: Uint8Array;
  heights: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  positions: Float32Array;
  roughness: Float32Array;
  shore: Float32Array;
  uvs: Float32Array;
}

export interface TerrainGeometryBounds {
  boxMax: readonly [number, number, number];
  boxMin: readonly [number, number, number];
  sphereCenter: readonly [number, number, number];
  sphereRadius: number;
}

export function getTerrainGeometryBufferViews(
  buffers: TerrainGeometryBuffers,
): Array<Float32Array | Uint8Array | Uint32Array> {
  return [
    buffers.biomeIds,
    buffers.colors,
    buffers.explored,
    buffers.groundWeights0,
    buffers.groundWeights1,
    buffers.heights,
    buffers.indices,
    buffers.normals,
    buffers.positions,
    buffers.roughness,
    buffers.shore,
    buffers.uvs,
  ];
}

export interface TerrainPageDiagnostics {
  biomeMismatchCount: number;
  frontierEdges: number;
  geometryBytes: number;
  prepareMs: number;
  shroudInstances: number;
  triangles: number;
  vertices: number;
}

export interface PreparedTerrainPage {
  buffers: TerrainGeometryBuffers;
  diagnostics: TerrainPageDiagnostics;
  fingerprint: string;
  request: TerrainPageRequest;
  shroudInstances: readonly TerrainShroudInstance[];
  propInstances: readonly TerrainPropInstance[];
  waterBuffers: TerrainGeometryBuffers | null;
}

export interface TerrainShroudInstance {
  col: number;
  frontier: boolean;
  pageKey: string;
  row: number;
  seed: number;
  tint: readonly [number, number, number];
  worldX: number;
  worldY: number;
  worldZ: number;
}

export interface TerrainPropInstance {
  archetype: TerrainPropArchetypeId;
  ownerCol: number;
  ownerRow: number;
  pageKey: string;
  scale: number;
  tint: readonly [number, number, number];
  worldX: number;
  worldY: number;
  worldZ: number;
  yaw: number;
}
