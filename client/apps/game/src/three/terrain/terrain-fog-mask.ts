import type { TerrainShroudInstance } from "./terrain-types";

export const TERRAIN_FOG_MASK_RESOLUTION = 64;

export interface TerrainFogMaskBounds {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
}

export interface TerrainFogMask {
  bounds: TerrainFogMaskBounds;
  data: Uint8Array;
  resolution: number;
}

export interface TerrainFogRevealMask {
  instance: TerrainShroudInstance;
  progress: number;
}

const FOG_COVERAGE_RADIUS = 1.42;
const MASK_MARGIN = 1.7;

export function buildTerrainFogMask(
  instances: readonly TerrainShroudInstance[],
  resolution = TERRAIN_FOG_MASK_RESOLUTION,
): TerrainFogMask | null {
  if (instances.length === 0) return null;
  requireMaskResolution(resolution);
  const bounds = resolveFogMaskBounds(instances);
  const coverage = new Uint8Array(resolution * resolution);
  const distance = new Float32Array(coverage.length);
  distance.fill(Number.POSITIVE_INFINITY);
  instances.forEach((instance) => rasterizeFogCell(coverage, distance, resolution, bounds, instance));
  propagateFogDistance(distance, resolution, bounds);
  return { bounds, data: encodeFogDistanceMask(coverage, distance), resolution };
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

function rasterizeFogCell(
  coverage: Uint8Array,
  distance: Float32Array,
  resolution: number,
  bounds: TerrainFogMaskBounds,
  instance: TerrainShroudInstance,
): void {
  const pixelBounds = resolvePixelBounds(bounds, resolution, instance.worldX, instance.worldZ, FOG_COVERAGE_RADIUS);
  for (let pixelZ = pixelBounds.minZ; pixelZ <= pixelBounds.maxZ; pixelZ += 1) {
    for (let pixelX = pixelBounds.minX; pixelX <= pixelBounds.maxX; pixelX += 1) {
      const world = fogMaskPixelToWorld(bounds, resolution, pixelX, pixelZ);
      const localX = world.x - instance.worldX;
      const localZ = world.z - instance.worldZ;
      if (!isInsideFogHex(localX, localZ)) continue;
      const index = pixelZ * resolution + pixelX;
      coverage[index] = 255;
      if (isFrontierSeed(instance, localX, localZ)) distance[index] = 0;
    }
  }
}

function isInsideFogHex(localX: number, localZ: number): boolean {
  const absoluteX = Math.abs(localX);
  const absoluteZ = Math.abs(localZ);
  return (
    absoluteX <= FOG_COVERAGE_RADIUS * Math.cos(Math.PI / 6) &&
    absoluteZ + absoluteX / Math.sqrt(3) <= FOG_COVERAGE_RADIUS
  );
}

function isFrontierSeed(instance: TerrainShroudInstance, localX: number, localZ: number): boolean {
  if (!instance.frontier) return false;
  const towardExplored =
    (localX * instance.frontierDirection[0] + localZ * instance.frontierDirection[1]) / FOG_COVERAGE_RADIUS;
  return towardExplored >= 0.58;
}

function propagateFogDistance(distance: Float32Array, resolution: number, bounds: TerrainFogMaskBounds): void {
  const stepX = (bounds.maxX - bounds.minX) / (resolution - 1);
  const stepZ = (bounds.maxZ - bounds.minZ) / (resolution - 1);
  const diagonal = Math.hypot(stepX, stepZ);
  for (let z = 0; z < resolution; z += 1) {
    for (let x = 0; x < resolution; x += 1) {
      relaxFogDistance(distance, resolution, x, z, -1, 0, stepX);
      relaxFogDistance(distance, resolution, x, z, 0, -1, stepZ);
      relaxFogDistance(distance, resolution, x, z, -1, -1, diagonal);
      relaxFogDistance(distance, resolution, x, z, 1, -1, diagonal);
    }
  }
  for (let z = resolution - 1; z >= 0; z -= 1) {
    for (let x = resolution - 1; x >= 0; x -= 1) {
      relaxFogDistance(distance, resolution, x, z, 1, 0, stepX);
      relaxFogDistance(distance, resolution, x, z, 0, 1, stepZ);
      relaxFogDistance(distance, resolution, x, z, 1, 1, diagonal);
      relaxFogDistance(distance, resolution, x, z, -1, 1, diagonal);
    }
  }
}

function relaxFogDistance(
  distance: Float32Array,
  resolution: number,
  x: number,
  z: number,
  offsetX: number,
  offsetZ: number,
  step: number,
): void {
  const neighborX = x + offsetX;
  const neighborZ = z + offsetZ;
  if (neighborX < 0 || neighborZ < 0 || neighborX >= resolution || neighborZ >= resolution) return;
  const index = z * resolution + x;
  const neighbor = distance[neighborZ * resolution + neighborX] + step;
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
    mask.resolution,
    reveal.instance.worldX,
    reveal.instance.worldZ,
    clearRadius + edgeWidth,
  );
  for (let pixelZ = pixelBounds.minZ; pixelZ <= pixelBounds.maxZ; pixelZ += 1) {
    for (let pixelX = pixelBounds.minX; pixelX <= pixelBounds.maxX; pixelX += 1) {
      const world = fogMaskPixelToWorld(mask.bounds, mask.resolution, pixelX, pixelZ);
      const localX = world.x - reveal.instance.worldX;
      const localZ = world.z - reveal.instance.worldZ;
      const variation = revealEdgeVariation(localX, localZ, reveal.instance.seed);
      const distance = Math.hypot(localX, localZ) + variation * 0.13;
      const retained = smoothstep(clearRadius - edgeWidth, clearRadius + edgeWidth, distance);
      const index = pixelZ * mask.resolution + pixelX;
      data[index] = Math.round(data[index] * retained);
    }
  }
}

function revealEdgeVariation(localX: number, localZ: number, seed: number): number {
  return Math.sin(localX * 4.7 + seed * 11.3) * 0.55 + Math.sin(localZ * 5.9 - seed * 7.1) * 0.45;
}

function resolvePixelBounds(
  bounds: TerrainFogMaskBounds,
  resolution: number,
  worldX: number,
  worldZ: number,
  radius: number,
): { maxX: number; maxZ: number; minX: number; minZ: number } {
  return {
    maxX: clampPixel(worldToFogMaskPixel(worldX + radius, bounds.minX, bounds.maxX, resolution), resolution),
    maxZ: clampPixel(worldToFogMaskPixel(worldZ + radius, bounds.minZ, bounds.maxZ, resolution), resolution),
    minX: clampPixel(worldToFogMaskPixel(worldX - radius, bounds.minX, bounds.maxX, resolution), resolution),
    minZ: clampPixel(worldToFogMaskPixel(worldZ - radius, bounds.minZ, bounds.maxZ, resolution), resolution),
  };
}

function fogMaskPixelToWorld(
  bounds: TerrainFogMaskBounds,
  resolution: number,
  pixelX: number,
  pixelZ: number,
): { x: number; z: number } {
  return {
    x: bounds.minX + (pixelX / (resolution - 1)) * (bounds.maxX - bounds.minX),
    z: bounds.minZ + (pixelZ / (resolution - 1)) * (bounds.maxZ - bounds.minZ),
  };
}

function worldToFogMaskPixel(value: number, minimum: number, maximum: number, resolution: number): number {
  return Math.floor(((value - minimum) / (maximum - minimum)) * (resolution - 1));
}

function clampPixel(value: number, resolution: number): number {
  return Math.min(resolution - 1, Math.max(0, value));
}

function requireMaskResolution(resolution: number): void {
  if (!Number.isInteger(resolution) || resolution < 32 || resolution > 1024) {
    throw new Error(`Terrain fog mask resolution must be an integer from 32 to 1024, received ${resolution}`);
  }
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = clampUnit((value - edge0) / (edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
