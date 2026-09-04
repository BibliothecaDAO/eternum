import { Biome } from "@bibliothecadao/eternum";
import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types";
import { Color } from "three";

import { hashTerrainCoordinates, terrainHashToUnitFloat } from "./terrain-hash";
import { TERRAIN_BIOME_ART_DIRECTIONS, type TerrainBiomeArtDirection } from "./terrain-biome-art-direction";
import {
  applyTerrainGroundRoad,
  applyTerrainGroundSlope,
  applyTerrainGroundStructurePad,
  blendTerrainGroundWeights,
  normalizeTerrainGroundWeights,
  resolveTerrainGroundEcology,
  resolveTerrainGroundRecipe,
  type TerrainGroundWeights,
} from "./terrain-ground-profile";
import { TERRAIN_BIOME_DESCRIPTORS, type TerrainBiomeDescriptor } from "./terrain-palette";
import { resolveTerrainSettlementInfluence } from "./terrain-settlements";
import {
  findNearestTerrainHex,
  terrainCellKey,
  terrainHexToWorld,
  terrainNeighborCoordinates,
} from "./terrain-coordinates";
import type { TerrainCellInput, TerrainPageRequest, TerrainSurfaceSample } from "./terrain-types";
import { isTerrainWaterBiome } from "./terrain-water";

interface CellFieldSample {
  baseHeight: number;
  biome: BiomeType;
  biomeId: number;
  centerX: number;
  centerZ: number;
  col: number;
  descriptor: TerrainBiomeDescriptor;
  direction: TerrainBiomeArtDirection;
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

export interface TerrainVegetationField {
  canopyCover: number;
  debrisCover: number;
  disturbanceStrength: number;
  edgeStrength: number;
  gapStrength: number;
  maturity: number;
  roadEdgeStrength: number;
  successionStrength: number;
  understoryCover: number;
  waterEdgeStrength: number;
}

export interface TerrainPropDensityContext extends TerrainVegetationField {
  biomeInfluences: readonly TerrainBiomeInfluence[];
  clearance: number;
  elevation: number;
  moisture: number;
  patchiness: number;
  settlementEdgeStrength: number;
}

export interface TerrainVisualSample extends TerrainSurfaceSample {
  biomeId: number;
  color: readonly [number, number, number];
  explored: number;
  groundWeights: TerrainGroundWeights;
  roughness: number;
  shore: number;
  uvOffset: readonly [number, number];
}

const NORMAL_SAMPLE_DISTANCE = 0.035;
const PAD_INNER_RADIUS = 0.5;
const PAD_OUTER_RADIUS = 0.82;
const PROP_CLEARANCE_INNER_RADIUS = 0.68;
const PROP_CLEARANCE_OUTER_RADIUS = 1.22;
const ROAD_INNER_RADIUS = 0.24;
const ROAD_OUTER_RADIUS = 0.62;
const ROAD_PROP_CLEARANCE_INNER_RADIUS = 0.32;
const ROAD_PROP_CLEARANCE_OUTER_RADIUS = 0.72;
const ROAD_VERGE_INNER_RADIUS = 0.54;
const ROAD_VERGE_PEAK_RADIUS = 0.82;
const ROAD_VERGE_OUTER_RADIUS = 1.18;
const TERRAIN_DISTURBED_GROUND_COLOR = new Color("#8b6d43");
const SETTLEMENT_REGROWTH_INNER_RADIUS = 0.82;
const SETTLEMENT_REGROWTH_PEAK_RADIUS = 1.18;
const SETTLEMENT_REGROWTH_OUTER_RADIUS = 1.9;

export class TerrainField {
  private readonly cellByKey = new Map<string, TerrainCellInput>();
  private readonly sampleByKey = new Map<string, CellFieldSample>();
  private readonly candidatesByKey = new Map<string, CellFieldSample[]>();
  private readonly frontierByKey = new Map<string, boolean>();
  private readonly previewSampleByKey = new Map<string, CellFieldSample>();
  private readonly previewCandidatesByKey = new Map<string, CellFieldSample[]>();
  private readonly elevationSeed: number;
  private readonly moistureSeed: number;
  private biomeMismatchCount: number | null = null;

  constructor(private readonly request: TerrainPageRequest) {
    request.halo.forEach(requireConsistentTerrainCellExploration);
    request.cells.forEach(requireConsistentTerrainCellExploration);
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

  isFrontierCell(col: number, row: number): boolean {
    const key = terrainCellKey(col, row);
    const cached = this.frontierByKey.get(key);
    if (cached !== undefined) return cached;
    const cell = this.getCell(col, row);
    const frontier = Boolean(
      cell &&
      !cell.explored &&
      terrainNeighborCoordinates(col, row).some((neighbor) => this.getCell(neighbor.col, neighbor.row)?.explored),
    );
    this.frontierByKey.set(key, frontier);
    return frontier;
  }

  getFogPreviewBiome(col: number, row: number): BiomeType | null {
    return this.resolvePreviewCellSample(col, row)?.biome ?? null;
  }

  sampleFogPreviewVertex(
    worldX: number,
    worldZ: number,
    owner: Pick<TerrainCellInput, "col" | "row">,
  ): TerrainVisualSample {
    if (this.getCell(owner.col, owner.row)?.explored !== false) return createUnknownSample();
    return this.sampleVertexFromCandidates(worldX, worldZ, this.resolveFogPreviewCandidates(owner.col, owner.row), 0);
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
    explored = 1,
  ): TerrainVisualSample {
    if (candidates.length === 0) return createUnknownSample();

    let totalWeight = 0;
    let height = 0;
    let roughness = 0;
    let red = 0;
    let green = 0;
    let blue = 0;
    let relief = 0;
    let macroTintStrength = 0;
    let shoreWetness = 0;
    const groundWeights = Array.from({ length: 8 }, () => 0);
    let strongestWeight = -1;
    let strongestBiome = candidates[0].biome;
    let strongestBiomeId = candidates[0].biomeId;
    const macroMaterial = terrainValueNoise(
      worldX * 0.42,
      worldZ * 0.42,
      this.elevationSeed,
      this.moistureSeed,
      "terrain-color-v1",
    );
    const colorMix = 0.18 + macroMaterial * 0.28;

    for (const candidate of candidates) {
      const distanceSquared = (candidate.centerX - worldX) ** 2 + (candidate.centerZ - worldZ) ** 2;
      const weight = terrainBlendWeight(distanceSquared);
      if (weight === 0) continue;
      totalWeight += weight;
      height += candidate.baseHeight * weight;
      roughness += candidate.descriptor.roughness * weight;
      relief += candidate.descriptor.relief * weight;
      macroTintStrength += candidate.direction.material.macroTintStrength * weight;
      shoreWetness += candidate.direction.material.shoreWetness * weight;
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

    if (totalWeight === 0) return createUnknownSample();

    const inverseWeight = 1 / totalWeight;
    const shapedHeight = this.resolveDetailedHeight(worldX, worldZ, height * inverseWeight, relief * inverseWeight);
    const paddedHeight = this.applyStructurePad(worldX, worldZ, shapedHeight, candidates);
    const weightedEnvironment = this.sampleWeightedEnvironment(worldX, worldZ, candidates);
    const vegetation = this.resolveVegetationField(worldX, worldZ, candidates, weightedEnvironment);
    const shore = this.sampleShoreProximity(worldX, worldZ, candidates);
    const groundEcology = resolveTerrainGroundEcology(normalizeTerrainGroundWeights(groundWeights), {
      allowsVegetation: explored === 1 && !isTerrainWaterBiome(strongestBiome),
      moisture: weightedEnvironment.moisture,
      shore,
      vegetation,
    });
    const road = this.sampleRoadProximity(worldX, worldZ);
    const roadGroundWeights = applyTerrainGroundRoad(groundEcology.weights, road);
    const structurePad = this.resolveStructurePadWeight(worldX, worldZ, candidates);
    const paddedGroundWeights = applyTerrainGroundStructurePad(roadGroundWeights, structurePad);

    const macroStrength = macroTintStrength * inverseWeight;
    const wetness = shore * shoreWetness * inverseWeight;
    const macroFactor = 1 + (macroMaterial * 2 - 1) * macroStrength;
    const albedoFactor = macroFactor * (1 - wetness * 0.16) * (1 - road * 0.08);
    const disturbedColorBlend = Math.max(road * 0.72, vegetation.disturbanceStrength * 0.5, structurePad * 0.78);
    const baseColor = [red * inverseWeight, green * inverseWeight, blue * inverseWeight] as const;

    return {
      biome: strongestBiome,
      biomeId: strongestBiomeId,
      color: [
        (baseColor[0] + (TERRAIN_DISTURBED_GROUND_COLOR.r - baseColor[0]) * disturbedColorBlend) *
          albedoFactor *
          groundEcology.tint[0],
        (baseColor[1] + (TERRAIN_DISTURBED_GROUND_COLOR.g - baseColor[1]) * disturbedColorBlend) *
          albedoFactor *
          groundEcology.tint[1],
        (baseColor[2] + (TERRAIN_DISTURBED_GROUND_COLOR.b - baseColor[2]) * disturbedColorBlend) *
          albedoFactor *
          groundEcology.tint[2],
      ],
      explored,
      groundWeights: paddedGroundWeights,
      height: paddedHeight,
      normal: [0, 1, 0],
      roughness: clampUnit(
        roughness * inverseWeight +
          (macroMaterial - 0.5) * 0.08 -
          wetness * 0.18 +
          groundEcology.roughnessOffset +
          road * 0.035,
      ),
      shore,
      uvOffset: [(macroMaterial - 0.5) * macroStrength * 0.42, (0.5 - macroMaterial) * macroStrength * 0.27],
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
    const vegetation = this.resolveVegetationField(worldX, worldZ, candidates, weightedEnvironment);
    return {
      ...weightedEnvironment,
      ...vegetation,
      patchiness: 1 - vegetation.gapStrength,
    };
  }

  sampleVegetationField(
    worldX: number,
    worldZ: number,
    owner: Pick<TerrainCellInput, "col" | "row">,
  ): TerrainVegetationField {
    const candidates = this.resolveExploredCandidates(owner.col, owner.row);
    return this.resolveVegetationField(
      worldX,
      worldZ,
      candidates,
      this.sampleWeightedEnvironment(worldX, worldZ, candidates),
    );
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
    explored = 1,
  ): TerrainVisualSample {
    const center = this.sampleVisualFromCandidates(worldX, worldZ, candidates, explored);
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
    const shapedHeight = this.resolveDetailedHeight(worldX, worldZ, height * inverseWeight, relief * inverseWeight);
    return this.applyStructurePad(worldX, worldZ, shapedHeight, candidates);
  }

  private sampleWeightedEnvironment(
    worldX: number,
    worldZ: number,
    candidates: readonly CellFieldSample[],
  ): Pick<
    TerrainPropDensityContext,
    | "biomeInfluences"
    | "clearance"
    | "elevation"
    | "moisture"
    | "roadEdgeStrength"
    | "settlementEdgeStrength"
    | "waterEdgeStrength"
  > {
    let totalWeight = 0;
    let elevation = 0;
    let moisture = 0;
    const settlement = this.sampleSettlementInfluence(worldX, worldZ);
    const biomeWeights = new Map<BiomeType, number>();

    for (const candidate of candidates) {
      const distanceSquared = (candidate.centerX - worldX) ** 2 + (candidate.centerZ - worldZ) ** 2;
      const weight = terrainBlendWeight(distanceSquared);
      if (weight === 0) continue;
      totalWeight += weight;
      elevation += candidate.elevation * weight;
      moisture += candidate.moisture * weight;
      biomeWeights.set(candidate.biome, (biomeWeights.get(candidate.biome) ?? 0) + weight);
    }

    const clearance = Math.min(settlement.clearance, this.sampleRoadClearance(worldX, worldZ));
    const roadEdgeStrength = this.sampleRoadEdgeStrength(worldX, worldZ);
    const waterEdgeStrength = this.sampleShoreProximity(worldX, worldZ, candidates);
    if (totalWeight === 0) {
      return {
        biomeInfluences: [],
        clearance,
        elevation: 0,
        moisture: 0,
        roadEdgeStrength,
        settlementEdgeStrength: settlement.edgeStrength,
        waterEdgeStrength,
      };
    }
    const inverseWeight = 1 / totalWeight;
    return {
      biomeInfluences: Array.from(biomeWeights, ([biome, weight]) => ({
        biome,
        weight: weight * inverseWeight,
      })).toSorted((left, right) => left.biome.localeCompare(right.biome)),
      clearance,
      elevation: elevation * inverseWeight,
      moisture: moisture * inverseWeight,
      roadEdgeStrength,
      settlementEdgeStrength: settlement.edgeStrength,
      waterEdgeStrength,
    };
  }

  private resolveVegetationField(
    worldX: number,
    worldZ: number,
    candidates: readonly CellFieldSample[],
    environment: Pick<
      TerrainPropDensityContext,
      | "biomeInfluences"
      | "clearance"
      | "elevation"
      | "moisture"
      | "roadEdgeStrength"
      | "settlementEdgeStrength"
      | "waterEdgeStrength"
    >,
  ): TerrainVegetationField {
    if (candidates.length === 0 || environment.biomeInfluences.length === 0) {
      return {
        canopyCover: 0,
        debrisCover: 0,
        disturbanceStrength: 0,
        edgeStrength: 0,
        gapStrength: 1,
        maturity: 0,
        roadEdgeStrength: 0,
        successionStrength: 0,
        understoryCover: 0,
        waterEdgeStrength: 0,
      };
    }

    const ecology = environment.biomeInfluences.reduce(
      (summary, influence) => {
        const profile = TERRAIN_BIOME_ART_DIRECTIONS[influence.biome].ecology;
        summary.canopyCover += profile.canopyCover * influence.weight;
        summary.clearingStrength += profile.clearingStrength * influence.weight;
        summary.clusterScale += profile.clusterScale * influence.weight;
        summary.undergrowth += profile.undergrowth * influence.weight;
        return summary;
      },
      { canopyCover: 0, clearingStrength: 0, clusterScale: 0, undergrowth: 0 },
    );
    const clusterScale = ecology.clusterScale || 0.2;
    const canopyPatch = terrainValueNoise(
      worldX * clusterScale,
      worldZ * clusterScale,
      this.elevationSeed,
      this.moistureSeed,
      "terrain-vegetation-canopy-v1",
    );
    const gapNoise = terrainValueNoise(
      worldX * Math.max(0.05, clusterScale * 0.58),
      worldZ * Math.max(0.05, clusterScale * 0.58),
      this.elevationSeed,
      this.moistureSeed,
      "terrain-vegetation-gaps-v1",
    );
    const debrisPatch = terrainValueNoise(
      worldX * Math.max(0.08, clusterScale * 1.7),
      worldZ * Math.max(0.08, clusterScale * 1.7),
      this.elevationSeed,
      this.moistureSeed,
      "terrain-vegetation-debris-v1",
    );
    const gapThreshold = 0.7 - ecology.clearingStrength * 0.22;
    const dominantBiomeInfluence = Math.max(...environment.biomeInfluences.map(({ weight }) => weight));
    const edgeStrength = clampUnit((1 - dominantBiomeInfluence) * 2);
    const disturbance = Math.max(
      1 - environment.clearance,
      environment.settlementEdgeStrength * 0.72,
      environment.roadEdgeStrength * 0.34,
    );
    const naturalGapStrength = clampUnit(
      smoothstep(gapThreshold, gapThreshold + 0.22, gapNoise) * (0.35 + ecology.clearingStrength * 0.65),
    );
    const gapStrength = Math.max(naturalGapStrength, disturbance * 0.92);
    const localMoisture = clampUnit(environment.moisture + environment.waterEdgeStrength * 0.2);
    const moistureSupport = 0.68 + smoothstep(0.16, 0.84, localMoisture) * 0.42;
    const elevationStress = 1 - smoothstep(0.58, 0.92, environment.elevation) * 0.26;
    const canopyCover = clampUnit(
      ecology.canopyCover *
        moistureSupport *
        elevationStress *
        (0.58 + smoothstep(0.16, 0.84, canopyPatch) * 0.55) *
        (1 - gapStrength * 0.78) *
        (1 - disturbance * 0.82),
    );
    const understoryCover = clampUnit(
      ecology.undergrowth *
        (0.58 + localMoisture * 0.42) *
        (0.72 + (1 - canopyCover) * 0.34) *
        (0.7 + smoothstep(0.12, 0.88, canopyPatch) * 0.38) +
        environment.roadEdgeStrength * 0.12 +
        environment.waterEdgeStrength * 0.18,
    );
    const debrisCover = clampUnit(
      canopyCover * (0.16 + smoothstep(0.18, 0.82, debrisPatch) * 0.46) * (1 - disturbance * 0.65) +
        environment.settlementEdgeStrength * 0.28,
    );
    const maturity = clampUnit(
      canopyCover * (0.5 + debrisPatch * 0.5) * (1 - edgeStrength * 0.55) * (1 - gapStrength * 0.6) * (1 - disturbance),
    );
    const disturbanceSuccession = 4 * disturbance * (1 - disturbance);
    const successionStrength = clampUnit(
      (edgeStrength * 0.72 + gapStrength * 0.35) * (0.45 + ecology.undergrowth * 0.55) +
        disturbanceSuccession * 0.65 +
        environment.roadEdgeStrength * 0.42 +
        environment.waterEdgeStrength * 0.28,
    );
    return {
      canopyCover,
      debrisCover,
      disturbanceStrength: disturbance,
      edgeStrength,
      gapStrength,
      maturity,
      roadEdgeStrength: environment.roadEdgeStrength,
      successionStrength,
      understoryCover,
      waterEdgeStrength: environment.waterEdgeStrength,
    };
  }

  private resolveExploredCandidates(col: number, row: number): CellFieldSample[] {
    const ownerKey = terrainCellKey(col, row);
    const cached = this.candidatesByKey.get(ownerKey);
    if (cached) return cached;
    const candidates = resolveTerrainCandidateCoordinates(col, row)
      .map((coordinate) => this.resolveCellSample(coordinate.col, coordinate.row))
      .filter((sample): sample is CellFieldSample => sample !== null)
      .toSorted((left, right) => left.row - right.row || left.col - right.col);
    this.candidatesByKey.set(ownerKey, candidates);
    return candidates;
  }

  private resolveFogPreviewCandidates(col: number, row: number): CellFieldSample[] {
    const ownerKey = terrainCellKey(col, row);
    const cached = this.previewCandidatesByKey.get(ownerKey);
    if (cached) return cached;
    const candidates = resolveTerrainCandidateCoordinates(col, row)
      .map((coordinate) => this.resolvePresentationCellSample(coordinate.col, coordinate.row))
      .filter((sample): sample is CellFieldSample => sample !== null)
      .toSorted((left, right) => left.row - right.row || left.col - right.col);
    this.previewCandidatesByKey.set(ownerKey, candidates);
    return candidates;
  }

  private resolvePresentationCellSample(col: number, row: number): CellFieldSample | null {
    const cell = this.getCell(col, row);
    if (!cell) return null;
    if (cell.explored) return this.resolveCellSample(col, row);
    return this.resolvePreviewCellSample(col, row);
  }

  private resolveCellSample(col: number, row: number): CellFieldSample | null {
    const key = terrainCellKey(col, row);
    const cached = this.sampleByKey.get(key);
    if (cached) return cached;
    const cell = this.cellByKey.get(key);
    if (!cell?.explored || !cell.biome) return null;
    return this.createCellSample(col, row, cell.biome, this.sampleByKey);
  }

  private resolvePreviewCellSample(col: number, row: number): CellFieldSample | null {
    const key = terrainCellKey(col, row);
    const cached = this.previewSampleByKey.get(key);
    if (cached) return cached;
    const cell = this.cellByKey.get(key);
    if (!cell || cell.explored) return null;
    return this.createCellSample(col, row, cell.previewBiome, this.previewSampleByKey);
  }

  private createCellSample(
    col: number,
    row: number,
    previewBiome: BiomeType | null,
    cache: Map<string, CellFieldSample>,
  ): CellFieldSample {
    const environment = Biome.sampleEnvironment(
      col + this.request.mapCenter,
      row + this.request.mapCenter,
      this.request.climate,
    );
    const biome = previewBiome ?? environment.biome;
    const descriptor = TERRAIN_BIOME_DESCRIPTORS[biome];
    const direction = TERRAIN_BIOME_ART_DIRECTIONS[biome];
    const center = terrainHexToWorld(col, row);
    const primary = new Color(descriptor.primary);
    const secondary = new Color(descriptor.secondary);
    const sample = {
      baseHeight:
        descriptor.baseHeight +
        (environment.elevation - 0.5) * descriptor.elevationScale +
        this.resolveMacroLandformOffset(center.x, center.z, direction),
      biome,
      biomeId: BiomeTypeToId[biome],
      centerX: center.x,
      centerZ: center.z,
      col,
      descriptor,
      direction,
      elevation: environment.elevation,
      groundWeights: resolveTerrainGroundRecipe(biome, environment),
      moisture: environment.moisture,
      primary: [primary.r, primary.g, primary.b] as const,
      row,
      sampledBiome: environment.biome,
      secondary: [secondary.r, secondary.g, secondary.b] as const,
    };
    cache.set(terrainCellKey(col, row), sample);
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

  private resolveDetailedHeight(worldX: number, worldZ: number, baseHeight: number, relief: number): number {
    const detail =
      (terrainValueNoise(worldX * 0.7, worldZ * 0.7, this.elevationSeed, this.moistureSeed, "terrain-relief-v1") -
        0.5) *
      2 *
      relief;
    return baseHeight + detail;
  }

  private resolveMacroLandformOffset(worldX: number, worldZ: number, direction: TerrainBiomeArtDirection): number {
    const { basinStrength, macroAmplitude, macroFrequency, ridgeStrength } = direction.landform;
    const macroNoise = terrainValueNoise(
      worldX * macroFrequency,
      worldZ * macroFrequency,
      this.elevationSeed,
      this.moistureSeed,
      "terrain-landform-v1",
    );
    const signedMacro = macroNoise * 2 - 1;
    const ridge = 1 - Math.abs(signedMacro);
    const basin = 1 - smoothstep(0.18, 0.72, macroNoise);
    const macroShape = signedMacro * 0.58 + (ridge - 0.5) * ridgeStrength * 0.72 - basin * basinStrength * 0.28;
    return macroShape * macroAmplitude;
  }

  private sampleShoreProximity(worldX: number, worldZ: number, candidates: readonly CellFieldSample[]): number {
    let nearestLand = Number.POSITIVE_INFINITY;
    let nearestWater = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const distance = Math.hypot(candidate.centerX - worldX, candidate.centerZ - worldZ);
      if (isTerrainWaterBiome(candidate.biome)) nearestWater = Math.min(nearestWater, distance);
      else nearestLand = Math.min(nearestLand, distance);
    }
    if (!Number.isFinite(nearestLand) || !Number.isFinite(nearestWater)) return 0;
    return 1 - smoothstep(0.05, 1.8, Math.abs(nearestWater - nearestLand));
  }

  private sampleRoadProximity(worldX: number, worldZ: number): number {
    if (this.request.roadSegments.length === 0) return 0;
    return 1 - smoothstep(ROAD_INNER_RADIUS, ROAD_OUTER_RADIUS, this.sampleRoadDistance(worldX, worldZ));
  }

  private sampleRoadClearance(worldX: number, worldZ: number): number {
    if (this.request.roadSegments.length === 0) return 1;
    return smoothstep(
      ROAD_PROP_CLEARANCE_INNER_RADIUS,
      ROAD_PROP_CLEARANCE_OUTER_RADIUS,
      this.sampleRoadDistance(worldX, worldZ),
    );
  }

  private sampleRoadEdgeStrength(worldX: number, worldZ: number): number {
    if (this.request.roadSegments.length === 0) return 0;
    const distance = this.sampleRoadDistance(worldX, worldZ);
    const outsideCore = smoothstep(ROAD_VERGE_INNER_RADIUS, ROAD_VERGE_PEAK_RADIUS, distance);
    const insideOuterEdge = 1 - smoothstep(ROAD_VERGE_PEAK_RADIUS, ROAD_VERGE_OUTER_RADIUS, distance);
    return outsideCore * insideOuterEdge;
  }

  private sampleSettlementInfluence(worldX: number, worldZ: number): { clearance: number; edgeStrength: number } {
    let clearance = 1;
    let edgeStrength = 0;
    for (const anchor of this.request.settlementAnchors) {
      const center = terrainHexToWorld(anchor.col, anchor.row);
      const distance = Math.hypot(center.x - worldX, center.z - worldZ);
      const influence = resolveTerrainSettlementInfluence(anchor);
      const scaledDistance = distance / influence.radiusScale;
      const candidateClearance = smoothstep(PROP_CLEARANCE_INNER_RADIUS, PROP_CLEARANCE_OUTER_RADIUS, scaledDistance);
      clearance = Math.min(clearance, 1 - (1 - candidateClearance) * influence.disturbanceStrength);
      edgeStrength = Math.max(
        edgeStrength,
        resolveSettlementRegrowthWeight(scaledDistance) * influence.disturbanceStrength,
      );
    }
    return { clearance, edgeStrength };
  }

  private sampleRoadDistance(worldX: number, worldZ: number): number {
    let nearest = Number.POSITIVE_INFINITY;
    for (const segment of this.request.roadSegments) {
      nearest = Math.min(nearest, pointToSegmentDistance(worldX, worldZ, segment.start, segment.end));
    }
    return nearest;
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

function requireConsistentTerrainCellExploration(cell: TerrainCellInput): void {
  if (cell.explored !== (cell.biome !== null)) {
    throw new Error(
      `Terrain cell ${cell.col},${cell.row} has inconsistent exploration and biome state: explored=${String(cell.explored)} biome=${String(cell.biome)}`,
    );
  }
  if (cell.previewBiome === BiomeType.None) {
    throw new Error(`Terrain cell ${cell.col},${cell.row} requires a concrete preview biome`);
  }
  if (cell.explored && cell.previewBiome !== cell.biome) {
    throw new Error(
      `Terrain cell ${cell.col},${cell.row} preview biome must match its explored biome: preview=${cell.previewBiome} biome=${String(cell.biome)}`,
    );
  }
}

function resolveTerrainCandidateCoordinates(col: number, row: number): Array<{ col: number; row: number }> {
  const oneRing = terrainNeighborCoordinates(col, row);
  const coordinates = [
    { col, row },
    ...oneRing,
    ...oneRing.flatMap((cell) => terrainNeighborCoordinates(cell.col, cell.row)),
  ];
  const seen = new Set<string>();
  return coordinates.filter((coordinate) => {
    const key = terrainCellKey(coordinate.col, coordinate.row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveSeed(value: number | undefined): number {
  return Number.isFinite(value) && value! > 0 ? Math.trunc(value!) : 0;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = clampUnit((value - edge0) / (edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
}

function pointToSegmentDistance(
  pointX: number,
  pointZ: number,
  start: readonly [number, number],
  end: readonly [number, number],
): number {
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
  if (lengthSquared <= Number.EPSILON) return Math.hypot(pointX - start[0], pointZ - start[1]);
  const projection = clampUnit(((pointX - start[0]) * deltaX + (pointZ - start[1]) * deltaZ) / lengthSquared);
  return Math.hypot(pointX - (start[0] + deltaX * projection), pointZ - (start[1] + deltaZ * projection));
}

function resolveSettlementRegrowthWeight(distance: number): number {
  const outsideCore = smoothstep(SETTLEMENT_REGROWTH_INNER_RADIUS, SETTLEMENT_REGROWTH_PEAK_RADIUS, distance);
  const insideOuterEdge = 1 - smoothstep(SETTLEMENT_REGROWTH_PEAK_RADIUS, SETTLEMENT_REGROWTH_OUTER_RADIUS, distance);
  return outsideCore * insideOuterEdge;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
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
    shore: 0,
    uvOffset: [0, 0],
  };
}
