import { BiomeType } from "@bibliothecadao/types";
import { Group } from "three";

import {
  TERRAIN_DUST_EMITTER_CAPACITY,
  TerrainDustInteractionPool,
  type TerrainDustInteraction,
  type TerrainDustInteractionStats,
  type TerrainDustSurface,
} from "./terrain-dust-interactions";
import {
  TERRAIN_WATER_INTERACTION_CAPACITY,
  TerrainWaterInteractionPool,
  type TerrainWaterInteraction,
  type TerrainWaterInteractionStats,
} from "./terrain-water-interactions";

export type TerrainMovementMode = "airborne" | "ground" | "naval";

export interface TerrainMovementInteraction {
  entityId: number;
  isMoving: boolean;
  mode: TerrainMovementMode;
  worldX: number;
  worldY: number;
  worldZ: number;
  yaw: number;
}

export interface TerrainMovementEffectStats {
  drawCalls: number;
  dust: TerrainDustInteractionStats;
  triangles: number;
  water: TerrainWaterInteractionStats;
}

type ResolveGroundBiome = (worldX: number, worldZ: number) => BiomeType | null;

interface SurfaceCacheEntry {
  lastSeenGeneration: number;
  surface: TerrainDustSurface | null;
  worldX: number;
  worldZ: number;
}

const SURFACE_SAMPLE_DISTANCE_SQUARED = 0.75 ** 2;

export class TerrainMovementEffects {
  readonly object3d = new Group();
  private readonly dust = new TerrainDustInteractionPool();
  private readonly water = new TerrainWaterInteractionPool();
  private readonly dustInputs: TerrainDustInteraction[] = [];
  private readonly waterInputs: TerrainWaterInteraction[] = [];
  private readonly surfaceCache = new Map<number, SurfaceCacheEntry>();
  private syncGeneration = 0;

  constructor(private readonly resolveGroundBiome: ResolveGroundBiome) {
    this.object3d.name = "terrain-movement-effects";
    this.object3d.add(this.water.object3d, this.dust.object3d);
  }

  sync(interactions: readonly TerrainMovementInteraction[]): void {
    interactions.forEach(requireFiniteMovementInteraction);
    this.syncGeneration += 1;
    let waterCount = 0;
    let dustCount = 0;
    for (const interaction of canonicalMovementInteractions(interactions)) {
      if (interaction.mode === "naval") {
        if (waterCount >= TERRAIN_WATER_INTERACTION_CAPACITY) continue;
        writeWaterInput(this.waterInputs, waterCount, interaction);
        waterCount += 1;
        continue;
      }
      if (interaction.mode !== "ground" || !interaction.isMoving) continue;
      if (dustCount >= TERRAIN_DUST_EMITTER_CAPACITY) continue;
      const surface = this.resolveDustSurface(interaction);
      if (!surface) continue;
      writeDustInput(this.dustInputs, dustCount, interaction, surface);
      dustCount += 1;
    }
    this.waterInputs.length = waterCount;
    this.dustInputs.length = dustCount;
    this.water.update(this.waterInputs);
    this.dust.sync(this.dustInputs);
    this.pruneSurfaceCache();
  }

  update(deltaSeconds: number): void {
    this.dust.update(deltaSeconds);
  }

  setQuality(waterStrength: number, dustStrength: number): void {
    this.water.setStrength(waterStrength);
    this.dust.setStrength(dustStrength);
  }

  getStats(): TerrainMovementEffectStats {
    const dust = this.dust.getStats();
    const water = this.water.getStats();
    return {
      drawCalls: dust.drawCalls + Number(water.instances > 0),
      dust,
      triangles: dust.triangles + water.triangles,
      water,
    };
  }

  clear(): void {
    this.dust.clear();
    this.water.update([]);
    this.surfaceCache.clear();
  }

  dispose(): void {
    this.clear();
    this.object3d.clear();
    this.dust.dispose();
    this.water.dispose();
  }

  private resolveDustSurface(interaction: TerrainMovementInteraction): TerrainDustSurface | null {
    const cached = this.surfaceCache.get(interaction.entityId);
    const movedDistanceSquared = cached
      ? (interaction.worldX - cached.worldX) ** 2 + (interaction.worldZ - cached.worldZ) ** 2
      : Number.POSITIVE_INFINITY;
    if (cached && movedDistanceSquared < SURFACE_SAMPLE_DISTANCE_SQUARED) {
      cached.lastSeenGeneration = this.syncGeneration;
      return cached.surface;
    }
    const surface = resolveTerrainDustSurface(this.resolveGroundBiome(interaction.worldX, interaction.worldZ));
    this.surfaceCache.set(interaction.entityId, {
      lastSeenGeneration: this.syncGeneration,
      surface,
      worldX: interaction.worldX,
      worldZ: interaction.worldZ,
    });
    return surface;
  }

  private pruneSurfaceCache(): void {
    for (const [entityId, cached] of this.surfaceCache) {
      if (cached.lastSeenGeneration !== this.syncGeneration) this.surfaceCache.delete(entityId);
    }
  }
}

function canonicalMovementInteractions(
  interactions: readonly TerrainMovementInteraction[],
): readonly TerrainMovementInteraction[] {
  for (let index = 1; index < interactions.length; index += 1) {
    if (interactions[index - 1].entityId > interactions[index].entityId) {
      return interactions.toSorted((left, right) => left.entityId - right.entityId);
    }
  }
  return interactions;
}

export function resolveTerrainDustSurface(biome: BiomeType | null): TerrainDustSurface | null {
  if (
    biome === BiomeType.Beach ||
    biome === BiomeType.Scorched ||
    biome === BiomeType.Bare ||
    biome === BiomeType.TemperateDesert ||
    biome === BiomeType.SubtropicalDesert ||
    biome === BiomeType.Shrubland ||
    biome === BiomeType.Tundra
  ) {
    return "dry";
  }
  if (biome === BiomeType.Grassland || biome === BiomeType.Taiga || biome === BiomeType.TropicalSeasonalForest) {
    return "grass";
  }
  if (
    biome === BiomeType.TemperateDeciduousForest ||
    biome === BiomeType.TemperateRainForest ||
    biome === BiomeType.TropicalRainForest
  ) {
    return "damp";
  }
  return null;
}

function writeWaterInput(
  target: TerrainWaterInteraction[],
  index: number,
  interaction: TerrainMovementInteraction,
): void {
  const existing = target[index];
  const next = existing ?? { entityId: 0, isMoving: false, worldX: 0, worldZ: 0, yaw: 0 };
  next.entityId = interaction.entityId;
  next.isMoving = interaction.isMoving;
  next.worldX = interaction.worldX;
  next.worldZ = interaction.worldZ;
  next.yaw = interaction.yaw;
  target[index] = next;
}

function writeDustInput(
  target: TerrainDustInteraction[],
  index: number,
  interaction: TerrainMovementInteraction,
  surface: TerrainDustSurface,
): void {
  const existing = target[index];
  const next =
    existing ??
    ({
      entityId: 0,
      groundY: 0,
      isMoving: false,
      surface: "dry",
      worldX: 0,
      worldZ: 0,
      yaw: 0,
    } satisfies TerrainDustInteraction);
  next.entityId = interaction.entityId;
  next.groundY = interaction.worldY;
  next.isMoving = interaction.isMoving;
  next.surface = surface;
  next.worldX = interaction.worldX;
  next.worldZ = interaction.worldZ;
  next.yaw = interaction.yaw;
  target[index] = next;
}

function requireFiniteMovementInteraction(interaction: TerrainMovementInteraction): void {
  if (
    !Number.isFinite(interaction.entityId) ||
    !Number.isFinite(interaction.worldX) ||
    !Number.isFinite(interaction.worldY) ||
    !Number.isFinite(interaction.worldZ) ||
    !Number.isFinite(interaction.yaw)
  ) {
    throw new Error(`Terrain movement interaction requires finite values: ${JSON.stringify(interaction)}`);
  }
}
