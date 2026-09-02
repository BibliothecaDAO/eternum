import type { TerrainShroudInstance } from "./terrain-types";

export const TERRAIN_FOG_MASK_TEXELS_PER_HEX_WIDTH = 4;

export interface TerrainFogMaskBounds {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
}

export interface TerrainFogMaskLayout {
  bounds: TerrainFogMaskBounds;
  height: number;
  width: number;
}

export interface TerrainFogMask extends TerrainFogMaskLayout {
  data: Uint8Array;
}

export interface TerrainFogRevealMask {
  instance: TerrainShroudInstance;
  progress: number;
}

interface TexelRect {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
}

interface FogRaster {
  coverage: Uint8Array;
  distance: Float32Array;
  height: number;
  rect: TexelRect;
  width: number;
}

const FOG_COVERAGE_RADIUS = 1.42;
const FRONTIER_FOG_COVERAGE_RADIUS = 1;
// Frontier seeds fade the mask over this distance; beyond it a texel reads as deep fog with or without a seed.
const FOG_DISTANCE_REACH = 1.5;
const MASK_MARGIN = 1.7;
const TERRAIN_HEX_WIDTH = Math.sqrt(3);
const TERRAIN_FOG_MASK_MIN_RESOLUTION = 32;
const TERRAIN_FOG_MASK_MAX_RESOLUTION = 1024;
const TERRAIN_FOG_MASK_TEXEL_DENSITY = TERRAIN_FOG_MASK_TEXELS_PER_HEX_WIDTH / TERRAIN_HEX_WIDTH;

export function resolveTerrainFogMaskLayout(instances: Iterable<TerrainShroudInstance>): TerrainFogMaskLayout | null {
  const bounds = resolveFogMaskBounds(instances);
  if (!bounds) return null;
  return {
    bounds,
    height: resolveBoundedMaskResolution(bounds.maxZ - bounds.minZ),
    width: resolveBoundedMaskResolution(bounds.maxX - bounds.minX),
  };
}

export function isSameTerrainFogMaskLayout(left: TerrainFogMaskLayout, right: TerrainFogMaskLayout): boolean {
  return (
    left.width === right.width &&
    left.height === right.height &&
    left.bounds.minX === right.bounds.minX &&
    left.bounds.maxX === right.bounds.maxX &&
    left.bounds.minZ === right.bounds.minZ &&
    left.bounds.maxZ === right.bounds.maxZ
  );
}

export function buildTerrainFogMask(instances: readonly TerrainShroudInstance[]): TerrainFogMask | null {
  const layout = resolveTerrainFogMaskLayout(instances);
  if (!layout) return null;
  const mask = { ...layout, data: new Uint8Array(layout.width * layout.height) };
  writeTerrainFogMaskRegion(mask, instances, layout.bounds);
  return mask;
}

/** The world area whose texels can change when these cells change: their coverage plus the frontier fade reach. */
export function resolveTerrainFogInfluence(instances: Iterable<TerrainShroudInstance>): TerrainFogMaskBounds | null {
  return resolveInstanceBounds(instances, FOG_COVERAGE_RADIUS + FOG_DISTANCE_REACH);
}

/** Re-rasterises the texels inside `region` from every cell that reaches them; returns the texels written. */
export function writeTerrainFogMaskRegion(
  mask: TerrainFogMask,
  instances: Iterable<TerrainShroudInstance>,
  region: TerrainFogMaskBounds,
): number {
  const target = resolveTexelRect(mask, region);
  if (!target) return 0;
  const raster = createFogRaster(expandTexelRect(mask, target, FOG_DISTANCE_REACH));
  for (const instance of instances) rasterizeFogCell(raster, mask, instance);
  propagateFogDistance(raster, resolveTexelSteps(mask));
  encodeFogDistanceMask(raster, mask, target);
  return (target.maxX - target.minX + 1) * (target.maxZ - target.minZ + 1);
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

function resolveFogMaskBounds(instances: Iterable<TerrainShroudInstance>): TerrainFogMaskBounds | null {
  return resolveInstanceBounds(instances, MASK_MARGIN);
}

function resolveInstanceBounds(
  instances: Iterable<TerrainShroudInstance>,
  margin: number,
): TerrainFogMaskBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const instance of instances) {
    minX = Math.min(minX, instance.worldX - margin);
    minZ = Math.min(minZ, instance.worldZ - margin);
    maxX = Math.max(maxX, instance.worldX + margin);
    maxZ = Math.max(maxZ, instance.worldZ + margin);
  }
  if (!Number.isFinite(minX)) return null;
  return { maxX, maxZ, minX, minZ };
}

function resolveBoundedMaskResolution(worldSpan: number): number {
  const resolution = Math.ceil(worldSpan * TERRAIN_FOG_MASK_TEXEL_DENSITY) + 1;
  return Math.min(TERRAIN_FOG_MASK_MAX_RESOLUTION, Math.max(TERRAIN_FOG_MASK_MIN_RESOLUTION, resolution));
}

function resolveTexelSteps(layout: TerrainFogMaskLayout): { x: number; z: number } {
  return {
    x: (layout.bounds.maxX - layout.bounds.minX) / (layout.width - 1),
    z: (layout.bounds.maxZ - layout.bounds.minZ) / (layout.height - 1),
  };
}

function resolveTexelRect(layout: TerrainFogMaskLayout, region: TerrainFogMaskBounds): TexelRect | null {
  const { bounds, height, width } = layout;
  const rect = {
    maxX: Math.ceil(fogMaskPixelCoordinate(region.maxX, bounds.minX, bounds.maxX, width)),
    maxZ: Math.ceil(fogMaskPixelCoordinate(region.maxZ, bounds.minZ, bounds.maxZ, height)),
    minX: Math.floor(fogMaskPixelCoordinate(region.minX, bounds.minX, bounds.maxX, width)),
    minZ: Math.floor(fogMaskPixelCoordinate(region.minZ, bounds.minZ, bounds.maxZ, height)),
  };
  if (rect.maxX < 0 || rect.maxZ < 0 || rect.minX >= width || rect.minZ >= height) return null;
  return clampTexelRect(rect, layout);
}

function expandTexelRect(layout: TerrainFogMaskLayout, rect: TexelRect, worldRadius: number): TexelRect {
  const steps = resolveTexelSteps(layout);
  const texelsX = Math.ceil(worldRadius / steps.x);
  const texelsZ = Math.ceil(worldRadius / steps.z);
  return clampTexelRect(
    { maxX: rect.maxX + texelsX, maxZ: rect.maxZ + texelsZ, minX: rect.minX - texelsX, minZ: rect.minZ - texelsZ },
    layout,
  );
}

function clampTexelRect(rect: TexelRect, layout: TerrainFogMaskLayout): TexelRect {
  return {
    maxX: clampPixel(rect.maxX, layout.width),
    maxZ: clampPixel(rect.maxZ, layout.height),
    minX: clampPixel(rect.minX, layout.width),
    minZ: clampPixel(rect.minZ, layout.height),
  };
}

function createFogRaster(rect: TexelRect): FogRaster {
  const width = rect.maxX - rect.minX + 1;
  const height = rect.maxZ - rect.minZ + 1;
  const distance = new Float32Array(width * height);
  distance.fill(Number.POSITIVE_INFINITY);
  return { coverage: new Uint8Array(width * height), distance, height, rect, width };
}

function rasterizeFogCell(raster: FogRaster, layout: TerrainFogMaskLayout, instance: TerrainShroudInstance): void {
  const coverageRadius = instance.frontier ? FRONTIER_FOG_COVERAGE_RADIUS : FOG_COVERAGE_RADIUS;
  const pixelBounds = resolvePixelBounds(layout, instance.worldX, instance.worldZ, coverageRadius);
  const minX = Math.max(pixelBounds.minX, raster.rect.minX);
  const maxX = Math.min(pixelBounds.maxX, raster.rect.maxX);
  const minZ = Math.max(pixelBounds.minZ, raster.rect.minZ);
  const maxZ = Math.min(pixelBounds.maxZ, raster.rect.maxZ);
  for (let pixelZ = minZ; pixelZ <= maxZ; pixelZ += 1) {
    for (let pixelX = minX; pixelX <= maxX; pixelX += 1) {
      const world = fogMaskPixelToWorld(layout, pixelX, pixelZ);
      const localX = world.x - instance.worldX;
      const localZ = world.z - instance.worldZ;
      if (!isInsideFogHex(localX, localZ, coverageRadius)) continue;
      const index = (pixelZ - raster.rect.minZ) * raster.width + (pixelX - raster.rect.minX);
      raster.coverage[index] = 255;
      if (isFrontierSeed(instance, localX, localZ, coverageRadius)) raster.distance[index] = 0;
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

function propagateFogDistance(raster: FogRaster, steps: { x: number; z: number }): void {
  const { distance, height, width } = raster;
  const diagonal = Math.hypot(steps.x, steps.z);
  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      relaxFogDistance(distance, width, height, x, z, -1, 0, steps.x);
      relaxFogDistance(distance, width, height, x, z, 0, -1, steps.z);
      relaxFogDistance(distance, width, height, x, z, -1, -1, diagonal);
      relaxFogDistance(distance, width, height, x, z, 1, -1, diagonal);
    }
  }
  for (let z = height - 1; z >= 0; z -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      relaxFogDistance(distance, width, height, x, z, 1, 0, steps.x);
      relaxFogDistance(distance, width, height, x, z, 0, 1, steps.z);
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

function encodeFogDistanceMask(raster: FogRaster, mask: TerrainFogMask, target: TexelRect): void {
  for (let pixelZ = target.minZ; pixelZ <= target.maxZ; pixelZ += 1) {
    for (let pixelX = target.minX; pixelX <= target.maxX; pixelX += 1) {
      const index = (pixelZ - raster.rect.minZ) * raster.width + (pixelX - raster.rect.minX);
      mask.data[pixelZ * mask.width + pixelX] = encodeFogTexel(raster.coverage[index], raster.distance[index]);
    }
  }
}

function encodeFogTexel(coverage: number, distance: number): number {
  if (coverage === 0) return 0;
  const depth = Number.isFinite(distance) ? smoothstep(0, FOG_DISTANCE_REACH, distance) : 1;
  return Math.round((0.18 + depth * 0.82) * 255);
}

function clearFogReveal(data: Uint8Array, mask: TerrainFogMask, reveal: TerrainFogRevealMask): void {
  const progress = clampUnit(reveal.progress);
  const clearRadius = 0.08 + progress * 1.42;
  const edgeWidth = 0.18 + progress * 0.12;
  const pixelBounds = resolvePixelBounds(mask, reveal.instance.worldX, reveal.instance.worldZ, clearRadius + edgeWidth);
  for (let pixelZ = pixelBounds.minZ; pixelZ <= pixelBounds.maxZ; pixelZ += 1) {
    for (let pixelX = pixelBounds.minX; pixelX <= pixelBounds.maxX; pixelX += 1) {
      const world = fogMaskPixelToWorld(mask, pixelX, pixelZ);
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

function resolvePixelBounds(layout: TerrainFogMaskLayout, worldX: number, worldZ: number, radius: number): TexelRect {
  const { bounds, height, width } = layout;
  return {
    maxX: clampPixel(Math.floor(fogMaskPixelCoordinate(worldX + radius, bounds.minX, bounds.maxX, width)), width),
    maxZ: clampPixel(Math.floor(fogMaskPixelCoordinate(worldZ + radius, bounds.minZ, bounds.maxZ, height)), height),
    minX: clampPixel(Math.floor(fogMaskPixelCoordinate(worldX - radius, bounds.minX, bounds.maxX, width)), width),
    minZ: clampPixel(Math.floor(fogMaskPixelCoordinate(worldZ - radius, bounds.minZ, bounds.maxZ, height)), height),
  };
}

function fogMaskPixelToWorld(layout: TerrainFogMaskLayout, pixelX: number, pixelZ: number): { x: number; z: number } {
  const { bounds, height, width } = layout;
  return {
    x: bounds.minX + (pixelX / (width - 1)) * (bounds.maxX - bounds.minX),
    z: bounds.minZ + (pixelZ / (height - 1)) * (bounds.maxZ - bounds.minZ),
  };
}

function fogMaskPixelCoordinate(value: number, minimum: number, maximum: number, resolution: number): number {
  return ((value - minimum) / (maximum - minimum)) * (resolution - 1);
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
