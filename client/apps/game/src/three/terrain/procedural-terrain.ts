import {
  BufferAttribute,
  BufferGeometry,
  Box3,
  Group,
  Mesh,
  Sphere,
  Vector3,
  type Intersection,
  type Object3D,
  type Raycaster,
} from "three";

import { TerrainField } from "./terrain-field";
import type { TerrainFogMask } from "./terrain-fog-mask";
import { acquireTerrainGroundTextures, type TerrainGroundTextureHandle } from "./terrain-ground-textures";
import { createTerrainGroundMaterial, createTerrainMaterials, type TerrainMaterials } from "./terrain-material";
import { prepareTerrainPage } from "./terrain-page-builder";
import { TerrainPageWorkerClient } from "./terrain-page-worker-client";
import { TerrainPropPools, type TerrainPropPoolStats } from "./terrain-prop-pools";
import type { TerrainPropLod } from "./terrain-prop-catalog";
import { TERRAIN_QUALITY_PROFILES, type TerrainQualityTier } from "./terrain-quality";
import { TerrainFogField, type TerrainFogFieldStats } from "./terrain-fog-field";
import {
  TerrainMovementEffects,
  type TerrainMovementEffectStats,
  type TerrainMovementInteraction,
} from "./terrain-movement-effects";
import type {
  PreparedTerrainPage,
  TerrainGeometryBuffers,
  TerrainPageRequest,
  TerrainSurfaceSample,
} from "./terrain-types";

interface PresentedTerrainPage {
  field: TerrainField;
  fingerprint: string;
  group: Group;
  propInstances: PreparedTerrainPage["propInstances"];
  shroudInstances: PreparedTerrainPage["shroudInstances"];
}

export interface TerrainPresentationDiagnostics {
  fogTerrainCells: number;
  frontierPreviewCells: number;
  geometryBytes: number;
  groundCoverInstances: number;
  pages: number;
  propInstances: number;
  propTriangles: number;
  roadSegments: number;
  settlementSites: number;
  shroudInstances: number;
  shroudTriangles: number;
  triangles: number;
  vertices: number;
}

export interface TerrainGroundTextureStats {
  bytes: number;
  layerCount: number;
  loaded: boolean;
}

export class ProceduralTerrain {
  readonly object3d = new Group();
  private readonly materials: TerrainMaterials;
  private readonly pages = new Map<string, PresentedTerrainPage>();
  private groundTextureDetailEnabled = true;
  private groundTextureMaterial: TerrainMaterials["land"] | null = null;
  private groundTextureHandle: TerrainGroundTextureHandle | null = null;
  private groundTexturesPromise: Promise<TerrainGroundTextureHandle> | null = null;
  private presentationGroup = new Group();
  private propLod: TerrainPropLod = "near";
  private qualityTier: TerrainQualityTier = "detail";
  private propPools: TerrainPropPools | null = null;
  private propPoolsPromise: Promise<TerrainPropPools> | null = null;
  private pageWorker: TerrainPageWorkerClient | null = null;
  private readonly fogField = new TerrainFogField();
  private readonly movementEffects: TerrainMovementEffects;
  private disposed = false;

  constructor() {
    this.object3d.name = "procedural-terrain";
    this.presentationGroup.name = "procedural-terrain-pages";
    this.movementEffects = new TerrainMovementEffects((worldX, worldZ) => this.sampleSurface(worldX, worldZ).biome);
    this.object3d.add(this.presentationGroup);
    this.object3d.add(this.fogField.object3d);
    this.object3d.add(this.movementEffects.object3d);
    this.materials = createTerrainMaterials();
    this.setQualityTier(this.qualityTier);
  }

  preparePage(request: TerrainPageRequest): PreparedTerrainPage {
    this.requireActive();
    return prepareTerrainPage(request);
  }

  preparePageAsync(request: TerrainPageRequest): Promise<PreparedTerrainPage> {
    this.requireActive();
    this.pageWorker ??= new TerrainPageWorkerClient();
    return this.pageWorker.prepare(request);
  }

  prepareFogMaskAsync(preparedPages: readonly PreparedTerrainPage[]): Promise<TerrainFogMask | null> {
    this.requireActive();
    this.pageWorker ??= new TerrainPageWorkerClient();
    const incoming = preparedPages.flatMap((page) => page.shroudInstances);
    return this.pageWorker.prepareFogMask(this.fogField.resolveIncomingFogCells(incoming));
  }

  async loadProps(): Promise<void> {
    this.requireActive();
    if (!this.propPoolsPromise) this.propPoolsPromise = TerrainPropPools.load();
    const pools = await this.propPoolsPromise;
    if (this.disposed) {
      pools.dispose();
      return;
    }
    if (!this.propPools) {
      this.propPools = pools;
      this.object3d.add(pools.object3d);
    }
    pools.setLod(this.propLod);
    pools.setWindStrength(TERRAIN_QUALITY_PROFILES[this.qualityTier].windStrength);
    this.refreshPropPools();
  }

  async loadGroundTextures(): Promise<void> {
    this.requireActive();
    this.groundTexturesPromise ??= acquireTerrainGroundTextures();
    const handle = await this.groundTexturesPromise;
    if (this.disposed) {
      handle.release();
      return;
    }
    if (this.groundTextureHandle) return;
    this.groundTextureHandle = handle;
    this.groundTextureMaterial = createTerrainGroundMaterial(handle.textures);
    this.refreshGroundMaterial();
  }

  setPropLod(lod: TerrainPropLod): void {
    this.propLod = lod;
    this.propPools?.setLod(lod);
  }

  setGroundTextureDetailEnabled(enabled: boolean): void {
    if (enabled === this.groundTextureDetailEnabled) return;
    this.groundTextureDetailEnabled = enabled;
    this.refreshGroundMaterial();
  }

  setQualityTier(tier: TerrainQualityTier): void {
    const profile = TERRAIN_QUALITY_PROFILES[tier];
    this.qualityTier = tier;
    this.setPropLod(profile.propLod);
    this.setGroundTextureDetailEnabled(profile.groundTextureDetail);
    this.propPools?.setWindStrength(profile.windStrength);
    this.fogField.setQuality(profile.fogMotionStrength, profile.fogMistStrength);
    this.movementEffects.setQuality(profile.waterInteractionStrength, profile.dustInteractionStrength);
    this.materials.waterMotion.value = profile.waterMotion;
  }

  getQualityTier(): TerrainQualityTier {
    return this.qualityTier;
  }

  isGroundTextureDetailEnabled(): boolean {
    return this.groundTextureDetailEnabled;
  }

  getPropStats(): TerrainPropPoolStats {
    return this.propPools?.getStats() ?? { groundCoverInstances: 0, instances: 0, triangles: 0 };
  }

  getGroundTextureStats(): TerrainGroundTextureStats {
    return {
      bytes: this.groundTextureHandle?.textures.bytes ?? 0,
      layerCount: this.groundTextureHandle?.textures.layerCount ?? 0,
      loaded: this.groundTextureHandle !== null,
    };
  }

  getShroudStats(): TerrainFogFieldStats {
    return this.fogField.getStats();
  }

  setMovementInteractions(interactions: readonly TerrainMovementInteraction[]): void {
    this.requireActive();
    this.movementEffects.sync(interactions);
  }

  getMovementInteractionStats(): TerrainMovementEffectStats {
    return this.movementEffects.getStats();
  }

  queueShroudReveal(col: number, row: number): void {
    this.fogField.queueReveal(col, row);
  }

  update(deltaSeconds: number): void {
    this.fogField.updateAnimation(deltaSeconds);
    this.movementEffects.update(deltaSeconds);
  }

  present(
    preparedPages: readonly PreparedTerrainPage[],
    preparedFogMask?: TerrainFogMask | null,
  ): TerrainPresentationDiagnostics {
    this.requireActive();
    requireUniquePageKeys(preparedPages);
    const nextPages = new Map<string, PresentedTerrainPage>();
    const nextGroup = new Group();
    nextGroup.name = "procedural-terrain-pages";

    for (const preparedPage of preparedPages) {
      const retained = this.pages.get(preparedPage.request.pageKey);
      const page =
        retained?.fingerprint === preparedPage.fingerprint ? retained : this.createPresentedPage(preparedPage);
      nextPages.set(preparedPage.request.pageKey, page);
      nextGroup.add(page.group);
    }

    this.commitPresentation(nextGroup, nextPages);
    this.refreshPropPools();
    this.refreshFogField(preparedFogMask);
    return summarizePresentation(preparedPages, this.getPropStats(), this.getShroudStats());
  }

  sampleSurface(worldX: number, worldZ: number): TerrainSurfaceSample {
    this.requireActive();
    for (const page of this.pages.values()) {
      const sample = page.field.sampleSurface(worldX, worldZ);
      if (sample.biome !== null) return sample;
    }
    return { biome: null, height: 0, normal: [0, 1, 0] };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pages.forEach(disposePresentedPage);
    this.pages.clear();
    this.presentationGroup.clear();
    this.object3d.clear();
    this.pageWorker?.dispose();
    this.pageWorker = null;
    this.propPools?.dispose();
    this.propPools = null;
    this.fogField.dispose();
    this.movementEffects.dispose();
    new Set(
      [this.materials.flatLand, this.materials.land, this.materials.water, this.groundTextureMaterial].filter(Boolean),
    ).forEach((material) => material!.dispose());
    this.groundTextureHandle?.release();
    this.groundTextureHandle = null;
    this.groundTextureMaterial = null;
  }

  private commitPresentation(nextGroup: Group, nextPages: Map<string, PresentedTerrainPage>): void {
    const previousGroup = this.presentationGroup;
    this.object3d.remove(previousGroup);
    this.object3d.add(nextGroup);
    this.presentationGroup = nextGroup;
    previousGroup.clear();

    for (const [pageKey, page] of this.pages) {
      if (nextPages.get(pageKey) !== page) disposePresentedPage(page);
    }
    this.pages.clear();
    nextPages.forEach((page, pageKey) => this.pages.set(pageKey, page));
  }

  private createPresentedPage(preparedPage: PreparedTerrainPage): PresentedTerrainPage {
    const group = new Group();
    group.name = `terrain-page:${preparedPage.request.pageKey}`;
    group.add(createTerrainMesh(preparedPage.buffers, this.materials.land, "land"));
    if (preparedPage.waterBuffers) {
      group.add(createTerrainMesh(preparedPage.waterBuffers, this.materials.water, "water"));
    }
    return {
      field: new TerrainField(preparedPage.request),
      fingerprint: preparedPage.fingerprint,
      group,
      propInstances: preparedPage.propInstances,
      shroudInstances: preparedPage.shroudInstances,
    };
  }

  private applyLandMaterial(): void {
    this.pages.forEach((page) => {
      page.group.traverse((object) => {
        if (object instanceof Mesh && object.name === "procedural-terrain-land") {
          object.material = this.materials.land;
        }
      });
    });
  }

  private refreshGroundMaterial(): void {
    this.materials.land =
      this.groundTextureDetailEnabled && this.groundTextureMaterial
        ? this.groundTextureMaterial
        : this.materials.flatLand;
    this.applyLandMaterial();
  }

  private refreshPropPools(): void {
    if (!this.propPools) return;
    this.propPools.update(Array.from(this.pages.values()).flatMap((page) => page.propInstances));
  }

  private refreshFogField(preparedMask?: TerrainFogMask | null): void {
    this.fogField.update(
      Array.from(this.pages.values()).flatMap((page) => page.shroudInstances),
      preparedMask,
    );
  }

  private requireActive(): void {
    if (this.disposed) throw new Error("ProceduralTerrain has been disposed");
  }
}

function createTerrainMesh(
  buffers: TerrainGeometryBuffers,
  material: TerrainMaterials["land"],
  layer: "land" | "water",
): Mesh {
  const geometry = new BufferGeometry();
  geometry.name = `procedural-terrain-${layer}`;
  geometry.setIndex(new BufferAttribute(buffers.indices, 1));
  geometry.setAttribute("position", new BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(buffers.normals, 3));
  geometry.setAttribute("uv", new BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute("terrainColor", new BufferAttribute(buffers.colors, 3));
  geometry.setAttribute("terrainRoughness", new BufferAttribute(buffers.roughness, 1));
  geometry.setAttribute("terrainShore", new BufferAttribute(buffers.shore, 1));
  geometry.setAttribute("terrainBiomeId", new BufferAttribute(buffers.biomeIds, 1));
  geometry.setAttribute("terrainExplored", new BufferAttribute(buffers.explored, 1));
  geometry.setAttribute("terrainGroundWeights0", new BufferAttribute(buffers.groundWeights0, 4, true));
  geometry.setAttribute("terrainGroundWeights1", new BufferAttribute(buffers.groundWeights1, 4, true));
  geometry.setAttribute("terrainHeight", new BufferAttribute(buffers.heights, 1));
  geometry.setAttribute("terrainWaterDepth", new BufferAttribute(buffers.waterDepth, 1));
  geometry.boundingBox = new Box3(new Vector3(...buffers.bounds.boxMin), new Vector3(...buffers.bounds.boxMax));
  geometry.boundingSphere = new Sphere(new Vector3(...buffers.bounds.sphereCenter), buffers.bounds.sphereRadius);

  const mesh = new Mesh(geometry, material);
  mesh.name = `procedural-terrain-${layer}`;
  mesh.castShadow = layer === "land";
  mesh.receiveShadow = true;
  mesh.raycast = disableTerrainRaycast;
  return mesh;
}

function disableTerrainRaycast(raycaster: Raycaster, intersects: Intersection<Object3D>[]): void {
  void raycaster;
  void intersects;
}

function disposePresentedPage(page: PresentedTerrainPage): void {
  page.group.traverse((object) => {
    if (object instanceof Mesh) object.geometry.dispose();
  });
  page.group.clear();
}

function requireUniquePageKeys(pages: readonly PreparedTerrainPage[]): void {
  const keys = new Set<string>();
  for (const page of pages) {
    if (keys.has(page.request.pageKey)) {
      throw new Error(`Terrain presentation received duplicate page: ${page.request.pageKey}`);
    }
    keys.add(page.request.pageKey);
  }
}

function summarizePresentation(
  pages: readonly PreparedTerrainPage[],
  propStats: TerrainPropPoolStats,
  shroudStats: TerrainFogFieldStats,
): TerrainPresentationDiagnostics {
  const roadSegments = new Set(
    pages.flatMap(({ request }) => request.roadSegments.map(({ start, end }) => `${start.join(",")}:${end.join(",")}`)),
  ).size;
  const settlementSites = new Set(
    pages.flatMap(({ request }) => request.settlementAnchors.map(({ structureId }) => structureId)),
  ).size;
  const terrain = pages.reduce<
    Omit<
      TerrainPresentationDiagnostics,
      | "groundCoverInstances"
      | "propInstances"
      | "propTriangles"
      | "roadSegments"
      | "settlementSites"
      | "shroudInstances"
      | "shroudTriangles"
    >
  >(
    (summary, page) => ({
      fogTerrainCells: summary.fogTerrainCells + page.diagnostics.fogTerrainCells,
      frontierPreviewCells: summary.frontierPreviewCells + page.diagnostics.frontierPreviewCells,
      geometryBytes: summary.geometryBytes + page.diagnostics.geometryBytes,
      pages: summary.pages + 1,
      triangles: summary.triangles + page.diagnostics.triangles,
      vertices: summary.vertices + page.diagnostics.vertices,
    }),
    {
      fogTerrainCells: 0,
      frontierPreviewCells: 0,
      geometryBytes: 0,
      pages: 0,
      triangles: 0,
      vertices: 0,
    },
  );
  return {
    ...terrain,
    groundCoverInstances: propStats.groundCoverInstances,
    propInstances: propStats.instances,
    propTriangles: propStats.triangles,
    roadSegments,
    settlementSites,
    shroudInstances: shroudStats.instances,
    shroudTriangles: shroudStats.triangles,
  };
}
