import type { TerrainShroudInstance } from "./terrain-types";

export const TERRAIN_FOG_MASK_TEXELS_PER_HEX_WIDTH = 4;

export interface TerrainFogMaskBounds {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
}

export interface TerrainFogMask {
  bounds: TerrainFogMaskBounds;
  data: Uint8Array;
  height: number;
  width: number;
}

export interface TerrainFogRevealMask {
  instance: TerrainShroudInstance;
  progress: number;
}

const FOG_COVERAGE_RADIUS = 1.42;
const FRONTIER_FOG_COVERAGE_RADIUS = 1;
const MASK_MARGIN = 1.7;
const TERRAIN_HEX_WIDTH = Math.sqrt(3);
const TERRAIN_FOG_MASK_MIN_RESOLUTION = 32;
const TERRAIN_FOG_MASK_MAX_RESOLUTION = 1024;
const TERRAIN_FOG_MASK_TEXEL_DENSITY = TERRAIN_FOG_MASK_TEXELS_PER_HEX_WIDTH / TERRAIN_HEX_WIDTH;

export function buildTerrainFogMask(instances: readonly TerrainShroudInstance[]): TerrainFogMask | null {
  if (instances.length === 0) return null;
  const bounds = resolveFogMaskBounds(instances);
  const { height, width } = resolveFogMaskDimensions(bounds);
  const coverage = new Uint8Array(width * height);
  const distance = new Float32Array(coverage.length);
  distance.fill(Number.POSITIVE_INFINITY);
  instances.forEach((instance) => rasterizeFogCell(coverage, distance, width, height, bounds, instance));
  propagateFogDistance(distance, width, height, bounds);
  return { bounds, data: encodeFogDistanceMask(coverage, distance), height, width };
}

export function applyTerrainFogReveals(
  mask: TerrainFogMask,
  reveals: readonly TerrainFogRevealMask[],
  target = new Uint8Array(mask.data.length),
): Uint8Array {
  if (target.length !== mask.data.length) {
    throw new Error(`Terrain fog reveal target length ${target.length} did not match mask length ${mask.data.length}`);
  }
  target.set(mask.data);
  reveals.forEach((reveal) => clearFogReveal(target, mask, reveal));
  return target;
}

function resolveFogMaskBounds(instances: readonly TerrainShroudInstance[]): TerrainFogMaskBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  instances.forEach((instance) => {
    minX = Math.min(minX, instance.worldX - MASK_MARGIN);
    minZ = Math.min(minZ, instance.worldZ - MASK_MARGIN);
    maxX = Math.max(maxX, instance.worldX + MASK_MARGIN);
    maxZ = Math.max(maxZ, instance.worldZ + MASK_MARGIN);
  });
  return { maxX, maxZ, minX, minZ };
}

function resolveFogMaskDimensions(bounds: TerrainFogMaskBounds): { height: number; width: number } {
  return {
    height: resolveBoundedMaskResolution(bounds.maxZ - bounds.minZ),
    width: resolveBoundedMaskResolution(bounds.maxX - bounds.minX),
  };
}

function resolveBoundedMaskResolution(worldSpan: number): number {
  const resolution = Math.ceil(worldSpan * TERRAIN_FOG_MASK_TEXEL_DENSITY) + 1;
  return Math.min(TERRAIN_FOG_MASK_MAX_RESOLUTION, Math.max(TERRAIN_FOG_MASK_MIN_RESOLUTION, resolution));
}

function rasterizeFogCell(
  coverage: Uint8Array,
  distance: Float32Array,
  width: number,
  height: number,
  bounds: TerrainFogMaskBounds,
  instance: TerrainShroudInstance,
): void {
  const coverageRadius = instance.frontier ? FRONTIER_FOG_COVERAGE_RADIUS : FOG_COVERAGE_RADIUS;
  const pixelBounds = resolvePixelBounds(bounds, width, height, instance.worldX, instance.worldZ, coverageRadius);
  for (let pixelZ = pixelBounds.minZ; pixelZ <= pixelBounds.maxZ; pixelZ += 1) {
    for (let pixelX = pixelBounds.minX; pixelX <= pixelBounds.maxX; pixelX += 1) {
      const world = fogMaskPixelToWorld(bounds, width, height, pixelX, pixelZ);
      const localX = world.x - instance.worldX;
      const localZ = world.z - instance.worldZ;
      if (!isInsideFogHex(localX, localZ, coverageRadius)) continue;
      const index = pixelZ * width + pixelX;
      coverage[index] = 255;
      if (isFrontierSeed(instance, localX, localZ, coverageRadius)) distance[index] = 0;
    }
  }
}

function isInsideFogHex(localX: number, localZ: number, coverageRadius: number): boolean {
  const absoluteX = Math.abs(localX);
  const absoluteZ = Math.abs(localZ);
  return absoluteX <= coverageRadius * Math.cos(Math.PI / 6) && absoluteZ + absoluteX / Math.sqrt(3) <= coverageRadius;
}

function isFrontierSeed(
  instance: TerrainShroudInstance,
  localX: number,
  localZ: number,
  coverageRadius: number,
): boolean {
  if (!instance.frontier) return false;
  const towardExplored =
    (localX * instance.frontierDirection[0] + localZ * instance.frontierDirection[1]) / coverageRadius;
  return towardExplored >= 0.58;
}

function propagateFogDistance(
  distance: Float32Array,
  width: number,
  height: number,
  bounds: TerrainFogMaskBounds,
): void {
  const stepX = (bounds.maxX - bounds.minX) / (width - 1);
  const stepZ = (bounds.maxZ - bounds.minZ) / (height - 1);
  const diagonal = Math.hypot(stepX, stepZ);
  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      relaxFogDistance(distance, width, height, x, z, -1, 0, stepX);
      relaxFogDistance(distance, width, height, x, z, 0, -1, stepZ);
      relaxFogDistance(distance, width, height, x, z, -1, -1, diagonal);
      relaxFogDistance(distance, width, height, x, z, 1, -1, diagonal);
    }
  }
  for (let z = height - 1; z >= 0; z -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      relaxFogDistance(distance, width, height, x, z, 1, 0, stepX);
      relaxFogDistance(distance, width, height, x, z, 0, 1, stepZ);
      relaxFogDistance(distance, width, height, x, z, 1, 1, diagonal);
      relaxFogDistance(distance, width, height, x, z, -1, 1, diagonal);
    }
  }
}

function relaxFogDistance(
  distance: Float32Array,
  width: number,
  height: number,
  x: number,
  z: number,
  offsetX: number,
  offsetZ: number,
  step: number,
): void {
  const neighborX = x + offsetX;
  const neighborZ = z + offsetZ;
  if (neighborX < 0 || neighborZ < 0 || neighborX >= width || neighborZ >= height) return;
  const index = z * width + x;
  const neighbor = distance[neighborZ * width + neighborX] + step;
  if (neighbor < distance[index]) distance[index] = neighbor;
}

function encodeFogDistanceMask(coverage: Uint8Array, distance: Float32Array): Uint8Array {
  const data = new Uint8Array(coverage.length);
  for (let index = 0; index < coverage.length; index += 1) {
    if (coverage[index] === 0) continue;
    const depth = Number.isFinite(distance[index]) ? smoothstep(0, 1.5, distance[index]) : 1;
    data[index] = Math.round((0.18 + depth * 0.82) * 255);
  }
  return data;
}

function clearFogReveal(data: Uint8Array, mask: TerrainFogMask, reveal: TerrainFogRevealMask): void {
  const progress = clampUnit(reveal.progress);
  const clearRadius = 0.08 + progress * 1.42;
  const edgeWidth = 0.18 + progress * 0.12;
  const pixelBounds = resolvePixelBounds(
    mask.bounds,
    mask.width,
    mask.height,
    reveal.instance.worldX,
    reveal.instance.worldZ,
    clearRadius + edgeWidth,
  );
  for (let pixelZ = pixelBounds.minZ; pixelZ <= pixelBounds.maxZ; pixelZ += 1) {
    for (let pixelX = pixelBounds.minX; pixelX <= pixelBounds.maxX; pixelX += 1) {
      const world = fogMaskPixelToWorld(mask.bounds, mask.width, mask.height, pixelX, pixelZ);
      const localX = world.x - reveal.instance.worldX;
      const localZ = world.z - reveal.instance.worldZ;
      const variation = revealEdgeVariation(localX, localZ, reveal.instance.seed);
      const distance = Math.hypot(localX, localZ) + variation * 0.13;
      const retained = smoothstep(clearRadius - edgeWidth, clearRadius + edgeWidth, distance);
      const index = pixelZ * mask.width + pixelX;
      data[index] = Math.round(data[index] * retained);
    }
  }
}

function revealEdgeVariation(localX: number, localZ: number, seed: number): number {
  return Math.sin(localX * 4.7 + seed * 11.3) * 0.55 + Math.sin(localZ * 5.9 - seed * 7.1) * 0.45;
}

function resolvePixelBounds(
  bounds: TerrainFogMaskBounds,
  width: number,
  height: number,
  worldX: number,
  worldZ: number,
  radius: number,
): { maxX: number; maxZ: number; minX: number; minZ: number } {
  return {
    maxX: clampPixel(worldToFogMaskPixel(worldX + radius, bounds.minX, bounds.maxX, width), width),
    maxZ: clampPixel(worldToFogMaskPixel(worldZ + radius, bounds.minZ, bounds.maxZ, height), height),
    minX: clampPixel(worldToFogMaskPixel(worldX - radius, bounds.minX, bounds.maxX, width), width),
    minZ: clampPixel(worldToFogMaskPixel(worldZ - radius, bounds.minZ, bounds.maxZ, height), height),
  };
}

function fogMaskPixelToWorld(
  bounds: TerrainFogMaskBounds,
  width: number,
  height: number,
  pixelX: number,
  pixelZ: number,
): { x: number; z: number } {
  return {
    x: bounds.minX + (pixelX / (width - 1)) * (bounds.maxX - bounds.minX),
    z: bounds.minZ + (pixelZ / (height - 1)) * (bounds.maxZ - bounds.minZ),
  };
}

function worldToFogMaskPixel(value: number, minimum: number, maximum: number, resolution: number): number {
  return Math.floor(((value - minimum) / (maximum - minimum)) * (resolution - 1));
}

function clampPixel(value: number, resolution: number): number {
  return Math.min(resolution - 1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = clampUnit((value - edge0) / (edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
