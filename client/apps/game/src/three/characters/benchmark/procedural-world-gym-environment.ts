import { Vector3, type Object3D } from "three";

import { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { TerrainPageRequest, TerrainSurfaceSample } from "@/three/terrain/terrain-types";
import { createAllBiomesTerrainRequest } from "@/three/terrain/verification/terrain-verification-fixtures";

const WORLD_GYM_MIN_COLUMN = 3;
const WORLD_GYM_MAX_COLUMN = 16;
const WORLD_GYM_MIN_ROW = 1;
const WORLD_GYM_MAX_ROW = 14;
const WORLD_GYM_PROP_DENSITY = 0.7;

export interface ProceduralWorldGymTerrainStats {
  biomeCount: number;
  cellCount: number;
  propInstances: number;
  triangles: number;
}

export class ProceduralWorldGymEnvironment {
  private readonly localSample = new Vector3();
  private readonly worldSample = new Vector3();
  private disposed = false;

  private constructor(
    private readonly terrain: ProceduralTerrain,
    private readonly stats: ProceduralWorldGymTerrainStats,
  ) {}

  public get object3d() {
    return this.terrain.object3d;
  }

  public static async create(): Promise<ProceduralWorldGymEnvironment> {
    const terrain = new ProceduralTerrain();
    try {
      const request = createProceduralWorldGymTerrainRequest();
      positionTerrainAtWorldOrigin(terrain, request);
      terrain.setQualityTier("balanced");
      await Promise.all([terrain.loadProps(), terrain.loadGroundTextures()]);
      const prepared = await terrain.preparePageAsync(request);
      const diagnostics = terrain.present([prepared]);
      return new ProceduralWorldGymEnvironment(terrain, {
        biomeCount: new Set(request.cells.map(({ biome }) => biome).filter((biome) => biome !== null)).size,
        cellCount: request.cells.length,
        propInstances: diagnostics.propInstances,
        triangles: diagnostics.triangles + diagnostics.propTriangles,
      });
    } catch (error) {
      terrain.dispose();
      throw error;
    }
  }

  public getStats(): ProceduralWorldGymTerrainStats {
    return { ...this.stats };
  }

  public sampleWorldSurface(worldX: number, worldZ: number): TerrainSurfaceSample {
    this.requireActive();
    this.object3d.updateWorldMatrix(true, false);
    this.localSample.set(worldX, 0, worldZ);
    this.object3d.worldToLocal(this.localSample);
    const sample = this.terrain.sampleSurface(this.localSample.x, this.localSample.z);
    if (sample.biome === null) return sample;
    this.localSample.y = sample.height;
    this.object3d.localToWorld(this.localSample);
    return { ...sample, height: this.localSample.y };
  }

  public sampleActorGround(
    actorObject: Object3D,
    localX: number,
    localZ: number,
    groundOffset: number,
  ): { height: number } {
    actorObject.getWorldPosition(this.worldSample);
    const actorRootY = this.worldSample.y;
    this.worldSample.set(localX, 0, localZ);
    actorObject.localToWorld(this.worldSample);
    const surface = this.sampleWorldSurface(this.worldSample.x, this.worldSample.z);
    return { height: surface.biome === null ? 0 : surface.height + groundOffset - actorRootY };
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    this.terrain.update(deltaSeconds);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object3d.removeFromParent();
    this.terrain.dispose();
  }

  private requireActive(): void {
    if (this.disposed) throw new Error("Procedural world gym environment has been disposed");
  }
}

export function createProceduralWorldGymTerrainRequest(): TerrainPageRequest {
  const source = createAllBiomesTerrainRequest();
  return {
    ...source,
    cells: source.cells.filter(isWorldGymCell),
    pageKey: "procedural-world-gym",
    propDensityMultiplier: WORLD_GYM_PROP_DENSITY,
  };
}

export function resolveProceduralWorldGymTerrainCenter(request: TerrainPageRequest): { x: number; z: number } {
  const centers = request.cells.map(({ col, row }) => terrainHexToWorld(col, row));
  const minX = Math.min(...centers.map(({ x }) => x));
  const maxX = Math.max(...centers.map(({ x }) => x));
  const minZ = Math.min(...centers.map(({ z }) => z));
  const maxZ = Math.max(...centers.map(({ z }) => z));
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
}

function isWorldGymCell({ col, row }: { col: number; row: number }): boolean {
  return (
    col >= WORLD_GYM_MIN_COLUMN && col <= WORLD_GYM_MAX_COLUMN && row >= WORLD_GYM_MIN_ROW && row <= WORLD_GYM_MAX_ROW
  );
}

function positionTerrainAtWorldOrigin(terrain: ProceduralTerrain, request: TerrainPageRequest): void {
  const center = resolveProceduralWorldGymTerrainCenter(request);
  terrain.object3d.position.set(-center.x, 0, -center.z);
  terrain.object3d.updateWorldMatrix(true, true);
}
