import { Biome } from "@bibliothecadao/eternum";
import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types";
import { Color } from "three";

import { hashTerrainCoordinates, terrainHashToUnitFloat } from "./terrain-hash";
import {
  applyTerrainGroundSlope,
  applyTerrainGroundStructurePad,
  blendTerrainGroundWeights,
  normalizeTerrainGroundWeights,
  resolveTerrainGroundRecipe,
  type TerrainGroundWeights,
} from "./terrain-ground-profile";
import { TERRAIN_BIOME_DESCRIPTORS, type TerrainBiomeDescriptor } from "./terrain-palette";
import {
  findNearestTerrainHex,
  terrainCellKey,
  terrainHexToWorld,
  terrainNeighborCoordinates,
} from "./terrain-coordinates";
import type { TerrainCellInput, TerrainPageRequest, TerrainSurfaceSample } from "./terrain-types";

interface CellFieldSample {
  baseHeight: number;
  biome: BiomeType;
  biomeId: number;
  centerX: number;
  centerZ: number;
  col: number;
  descriptor: TerrainBiomeDescriptor;
  elevation: number;
  groundWeights: TerrainGroundWeights;
  moisture: number;
  primary: readonly [number, number, number];
  row: number;
  sampledBiome: BiomeType;
  secondary: readonly [number, number, number];
}

export interface TerrainBiomeInfluence {
  biome: BiomeType;
  weight: number;
}

export interface TerrainPropDensityContext {
  biomeInfluences: readonly TerrainBiomeInfluence[];
  clearance: number;
  elevation: number;
  moisture: number;
  patchiness: number;
}

export interface TerrainVisualSample extends TerrainSurfaceSample {
  biomeId: number;
  color: readonly [number, number, number];
  explored: number;
  groundWeights: TerrainGroundWeights;
  roughness: number;
}

const NORMAL_SAMPLE_DISTANCE = 0.035;
const PAD_INNER_RADIUS = 0.5;
const PAD_OUTER_RADIUS = 0.82;
const PROP_CLEARANCE_INNER_RADIUS = 0.68;
const PROP_CLEARANCE_OUTER_RADIUS = 1.22;

export class TerrainField {
  private readonly cellByKey = new Map<string, TerrainCellInput>();
  private readonly sampleByKey = new Map<string, CellFieldSample>();
  private readonly candidatesByKey = new Map<string, CellFieldSample[]>();
  private readonly elevationSeed: number;
  private readonly moistureSeed: number;
  private biomeMismatchCount: number | null = null;

  constructor(private readonly request: TerrainPageRequest) {
    request.halo.forEach((cell) => this.cellByKey.set(terrainCellKey(cell.col, cell.row), cell));
    request.cells.forEach((cell) => this.cellByKey.set(terrainCellKey(cell.col, cell.row), cell));
    this.elevationSeed = resolveSeed(request.climate.elevation_seed);
    this.moistureSeed = resolveSeed(request.climate.moisture_seed);

    if (request.strictBiomeParity && this.getBiomeMismatchCount() > 0) {
      throw new Error(
        `${request.pageKey} has ${this.getBiomeMismatchCount()} projected biome/environment mismatch(es)`,
      );
    }
  }

  getBiomeMismatchCount(): number {
    this.biomeMismatchCount ??= this.countBiomeMismatches();
    return this.biomeMismatchCount;
  }

  getCell(col: number, row: number): TerrainCellInput | undefined {
    return this.cellByKey.get(terrainCellKey(col, row));
  }

  sampleVisual(worldX: number, worldZ: number, owner?: Pick<TerrainCellInput, "col" | "row">): TerrainVisualSample {
    const ownerCoordinate = owner ?? findNearestTerrainHex(worldX, worldZ);
    const candidates = this.resolveExploredCandidates(ownerCoordinate.col, ownerCoordinate.row);
    return this.sampleVisualFromCandidates(worldX, worldZ, candidates);
  }

  private sampleVisualFromCandidates(
    worldX: number,
    worldZ: number,
    candidates: readonly CellFieldSample[],
  ): TerrainVisualSample {
    if (candidates.length === 0) return createUnknownSample();

    let totalWeight = 0;
    let height = 0;
    let roughness = 0;
    let red = 0;
    let green = 0;
    let blue = 0;
    let relief = 0;
    const groundWeights = Array.from({ length: 8 }, () => 0);
    let strongestWeight = -1;
    let strongestBiome = candidates[0].biome;
    let strongestBiomeId = candidates[0].biomeId;
    const colorMix =
      0.18 +
      terrainValueNoise(worldX * 0.42, worldZ * 0.42, this.elevationSeed, this.moistureSeed, "terrain-color-v1") * 0.28;

    for (const candidate of candidates) {
      const distanceSquared = (candidate.centerX - worldX) ** 2 + (candidate.centerZ - worldZ) ** 2;
      const weight = terrainBlendWeight(distanceSquared);
      if (weight === 0) continue;
      totalWeight += weight;
      height += candidate.baseHeight * weight;
      roughness += candidate.descriptor.roughness * weight;
      relief += candidate.descriptor.relief * weight;
      blendTerrainGroundWeights(groundWeights, candidate.groundWeights, weight);
      red += (candidate.primary[0] + (candidate.secondary[0] - candidate.primary[0]) * colorMix) * weight;
      green += (candidate.primary[1] + (candidate.secondary[1] - candidate.primary[1]) * colorMix) * weight;
      blue += (candidate.primary[2] + (candidate.secondary[2] - candidate.primary[2]) * colorMix) * weight;

      if (weight > strongestWeight) {
        strongestWeight = weight;
        strongestBiome = candidate.biome;
        strongestBiomeId = candidate.biomeId;
      }
    }

    const inverseWeight = 1 / totalWeight;
    const baseHeight = height * inverseWeight;
    const detail =
      (terrainValueNoise(worldX * 0.7, worldZ * 0.7, this.elevationSeed, this.moistureSeed, "terrain-relief-v1") -
        0.5) *
      2 *
      relief *
      inverseWeight;
    const paddedHeight = this.applyStructurePad(worldX, worldZ, baseHeight + detail, candidates);
    const paddedGroundWeights = applyTerrainGroundStructurePad(
      normalizeTerrainGroundWeights(groundWeights),
      this.resolveStructurePadWeight(worldX, worldZ, candidates),
    );

    return {
      biome: strongestBiome,
      biomeId: strongestBiomeId,
      color: [red * inverseWeight, green * inverseWeight, blue * inverseWeight],
      explored: 1,
      groundWeights: paddedGroundWeights,
      height: paddedHeight,
      normal: [0, 1, 0],
      roughness: roughness * inverseWeight,
    };
  }

  sampleSurface(worldX: number, worldZ: number): TerrainSurfaceSample {
    return this.sampleVertex(worldX, worldZ);
  }

  samplePropDensityContext(
    worldX: number,
    worldZ: number,
    owner: Pick<TerrainCellInput, "col" | "row">,
  ): TerrainPropDensityContext {
    const candidates = this.resolveExploredCandidates(owner.col, owner.row);
    const weightedEnvironment = this.sampleWeightedEnvironment(worldX, worldZ, candidates);
    return {
      ...weightedEnvironment,
      patchiness: terrainValueNoise(
        worldX * 0.33,
        worldZ * 0.33,
        this.elevationSeed,
        this.moistureSeed,
        "terrain-prop-density-v1",
      ),
    };
  }

  samplePropSurface(
    worldX: number,
    worldZ: number,
    owner: Pick<TerrainCellInput, "col" | "row">,
  ): TerrainSurfaceSample {
    const candidates = this.resolveExploredCandidates(owner.col, owner.row);
    return {
      biome: this.getCell(owner.col, owner.row)?.biome ?? null,
      height: this.sampleHeightFromCandidates(worldX, worldZ, candidates),
      normal: this.sampleNormalFromCandidates(worldX, worldZ, candidates),
    };
  }

  sampleVertex(worldX: number, worldZ: number, owner?: Pick<TerrainCellInput, "col" | "row">): TerrainVisualSample {
    const ownerCoordinate = owner ?? findNearestTerrainHex(worldX, worldZ);
    return this.sampleVertexFromCandidates(
      worldX,
      worldZ,
      this.resolveExploredCandidates(ownerCoordinate.col, ownerCoordinate.row),
    );
  }

  private sampleVertexFromCandidates(
    worldX: number,
    worldZ: number,
    candidates: readonly CellFieldSample[],
  ): TerrainVisualSample {
    const center = this.sampleVisualFromCandidates(worldX, worldZ, candidates);
    if (center.biome === null) return center;
    const normal = this.sampleNormalFromCandidates(worldX, worldZ, candidates);
    return { ...center, groundWeights: applyTerrainGroundSlope(center.groundWeights, normal[1]), normal };
  }

  private sampleNormalFromCandidates(
    worldX: number,
    worldZ: number,
    candidates: readonly CellFieldSample[],
  ): readonly [number, number, number] {
    const left = this.sampleHeightFromCandidates(worldX - NORMAL_SAMPLE_DISTANCE, worldZ, candidates);
    const right = this.sampleHeightFromCandidates(worldX + NORMAL_SAMPLE_DISTANCE, worldZ, candidates);
    const down = this.sampleHeightFromCandidates(worldX, worldZ - NORMAL_SAMPLE_DISTANCE, candidates);
    const up = this.sampleHeightFromCandidates(worldX, worldZ + NORMAL_SAMPLE_DISTANCE, candidates);
    const normalX = left - right;
    const normalY = NORMAL_SAMPLE_DISTANCE * 2;
    const normalZ = down - up;
    const inverseLength = 1 / Math.hypot(normalX, normalY, normalZ);
    return [normalX * inverseLength, normalY * inverseLength, normalZ * inverseLength];
  }

  private sampleHeightFromCandidates(worldX: number, worldZ: number, candidates: readonly CellFieldSample[]): number {
    let totalWeight = 0;
    let height = 0;
    let relief = 0;
    for (const candidate of candidates) {
      const distanceSquared = (candidate.centerX - worldX) ** 2 + (candidate.centerZ - worldZ) ** 2;
      const weight = terrainBlendWeight(distanceSquared);
      if (weight === 0) continue;
      totalWeight += weight;
      height += candidate.baseHeight * weight;
      relief += candidate.descriptor.relief * weight;
    }
    if (totalWeight === 0) return TERRAIN_BIOME_DESCRIPTORS[BiomeType.None].baseHeight;
    const inverseWeight = 1 / totalWeight;
    const detail =
      (terrainValueNoise(worldX * 0.7, worldZ * 0.7, this.elevationSeed, this.moistureSeed, "terrain-relief-v1") -
        0.5) *
      2 *
      relief *
      inverseWeight;
    return this.applyStructurePad(worldX, worldZ, height * inverseWeight + detail, candidates);
  }

  private sampleWeightedEnvironment(
    worldX: number,
    worldZ: number,
    candidates: readonly CellFieldSample[],
  ): Pick<TerrainPropDensityContext, "biomeInfluences" | "clearance" | "elevation" | "moisture"> {
    let totalWeight = 0;
    let elevation = 0;
    let moisture = 0;
    let clearance = 1;
    const biomeWeights = new Map<BiomeType, number>();

    for (const candidate of candidates) {
      const distanceSquared = (candidate.centerX - worldX) ** 2 + (candidate.centerZ - worldZ) ** 2;
      const weight = terrainBlendWeight(distanceSquared);
      if (weight === 0) continue;
      const cell = this.cellByKey.get(terrainCellKey(candidate.col, candidate.row));
      if (cell?.occupied) {
        const distance = Math.sqrt(distanceSquared);
        clearance = Math.min(clearance, smoothstep(PROP_CLEARANCE_INNER_RADIUS, PROP_CLEARANCE_OUTER_RADIUS, distance));
      }
      totalWeight += weight;
      elevation += candidate.elevation * weight;
      moisture += candidate.moisture * weight;
      biomeWeights.set(candidate.biome, (biomeWeights.get(candidate.biome) ?? 0) + weight);
    }

    if (totalWeight === 0) return { biomeInfluences: [], clearance, elevation: 0, moisture: 0 };
    const inverseWeight = 1 / totalWeight;
    return {
      biomeInfluences: Array.from(biomeWeights, ([biome, weight]) => ({
        biome,
        weight: weight * inverseWeight,
      })).toSorted((left, right) => left.biome.localeCompare(right.biome)),
      clearance,
      elevation: elevation * inverseWeight,
      moisture: moisture * inverseWeight,
    };
  }

  private resolveExploredCandidates(col: number, row: number): CellFieldSample[] {
    const ownerKey = terrainCellKey(col, row);
    const cached = this.candidatesByKey.get(ownerKey);
    if (cached) return cached;
    const oneRing = terrainNeighborCoordinates(col, row);
    const coordinates = [
      { col, row },
      ...oneRing,
      ...oneRing.flatMap((cell) => terrainNeighborCoordinates(cell.col, cell.row)),
    ];
    const seen = new Set<string>();
    const candidates = coordinates
      .filter((coordinate) => {
        const key = terrainCellKey(coordinate.col, coordinate.row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((coordinate) => this.resolveCellSample(coordinate.col, coordinate.row))
      .filter((sample): sample is CellFieldSample => sample !== null)
      .toSorted((left, right) => left.row - right.row || left.col - right.col);
    this.candidatesByKey.set(ownerKey, candidates);
    return candidates;
  }

  private resolveCellSample(col: number, row: number): CellFieldSample | null {
    const key = terrainCellKey(col, row);
    const cached = this.sampleByKey.get(key);
    if (cached) return cached;
    const cell = this.cellByKey.get(key);
    if (!cell?.biome) return null;
    const environment = Biome.sampleEnvironment(
      col + this.request.mapCenter,
      row + this.request.mapCenter,
      this.request.climate,
    );
    const descriptor = TERRAIN_BIOME_DESCRIPTORS[cell.biome];
    const center = terrainHexToWorld(col, row);
    const primary = new Color(descriptor.primary);
    const secondary = new Color(descriptor.secondary);
    const sample = {
      baseHeight: descriptor.baseHeight + (environment.elevation - 0.5) * descriptor.elevationScale,
      biome: cell.biome,
      biomeId: BiomeTypeToId[cell.biome],
      centerX: center.x,
      centerZ: center.z,
      col,
      descriptor,
      elevation: environment.elevation,
      groundWeights: resolveTerrainGroundRecipe(cell.biome, environment),
      moisture: environment.moisture,
      primary: [primary.r, primary.g, primary.b] as const,
      row,
      sampledBiome: environment.biome,
      secondary: [secondary.r, secondary.g, secondary.b] as const,
    };
    this.sampleByKey.set(key, sample);
    return sample;
  }

  private applyStructurePad(
    worldX: number,
    worldZ: number,
    surfaceHeight: number,
    candidates: readonly CellFieldSample[],
  ): number {
    let result = surfaceHeight;
    for (const candidate of candidates) {
      const cell = this.cellByKey.get(terrainCellKey(candidate.col, candidate.row));
      if (!cell?.occupied) continue;
      const distance = Math.hypot(candidate.centerX - worldX, candidate.centerZ - worldZ);
      const padWeight = 1 - smoothstep(PAD_INNER_RADIUS, PAD_OUTER_RADIUS, distance);
      result += (candidate.baseHeight - result) * padWeight;
    }
    return result;
  }

  private resolveStructurePadWeight(worldX: number, worldZ: number, candidates: readonly CellFieldSample[]): number {
    let weight = 0;
    for (const candidate of candidates) {
      const cell = this.cellByKey.get(terrainCellKey(candidate.col, candidate.row));
      if (!cell?.occupied) continue;
      const distance = Math.hypot(candidate.centerX - worldX, candidate.centerZ - worldZ);
      const candidateWeight = 1 - smoothstep(PAD_INNER_RADIUS, PAD_OUTER_RADIUS, distance);
      weight = Math.max(weight, candidateWeight);
    }
    return weight;
  }

  private countBiomeMismatches(): number {
    return this.request.cells.reduce((count, cell) => {
      if (!cell.biome) return count;
      const sampled = this.resolveCellSample(cell.col, cell.row);
      return count + (sampled?.sampledBiome === cell.biome ? 0 : 1);
    }, 0);
  }
}

function resolveSeed(value: number | undefined): number {
  return Number.isFinite(value) && value! > 0 ? Math.trunc(value!) : 0;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return normalized * normalized * (3 - 2 * normalized);
}

function terrainBlendWeight(distanceSquared: number): number {
  if (distanceSquared >= 4) return 0;
  const support = 1 - distanceSquared / 4;
  return (support * support * support * support) / (0.04 + distanceSquared * distanceSquared);
}

function terrainValueNoise(x: number, z: number, elevationSeed: number, moistureSeed: number, salt: string): number {
  const minX = Math.floor(x);
  const minZ = Math.floor(z);
  const fractionX = smoothstep(0, 1, x - minX);
  const fractionZ = smoothstep(0, 1, z - minZ);
  const bottomLeft = hashNoise(minX, minZ, elevationSeed, moistureSeed, salt);
  const bottomRight = hashNoise(minX + 1, minZ, elevationSeed, moistureSeed, salt);
  const topLeft = hashNoise(minX, minZ + 1, elevationSeed, moistureSeed, salt);
  const topRight = hashNoise(minX + 1, minZ + 1, elevationSeed, moistureSeed, salt);
  const bottom = bottomLeft + (bottomRight - bottomLeft) * fractionX;
  const top = topLeft + (topRight - topLeft) * fractionX;
  return bottom + (top - bottom) * fractionZ;
}

function hashNoise(col: number, row: number, elevationSeed: number, moistureSeed: number, salt: string): number {
  return terrainHashToUnitFloat(hashTerrainCoordinates({ col, elevationSeed, moistureSeed, row, salt }));
}

function createUnknownSample(): TerrainVisualSample {
  const descriptor = TERRAIN_BIOME_DESCRIPTORS[BiomeType.None];
  const color = new Color(descriptor.primary);
  return {
    biome: null,
    biomeId: 0,
    color: [color.r, color.g, color.b],
    explored: 0,
    groundWeights: [0, 0, 1, 0, 0, 0, 0, 0],
    height: descriptor.baseHeight,
    normal: [0, 1, 0],
    roughness: descriptor.roughness,
  };
}
