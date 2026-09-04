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

/** Cumulative upload work, except `propPoolPaddingInstances`, which is the padding drawn right now. */
export interface TerrainUploadMetrics {
  fogMaskFullRebuilds: number;
  fogMaskPageWrites: number;
  fogMaskTexelsWritten: number;
  /** Every retained page rewritten at once; only the prop catalog arriving after pages were presented does this. */
  propPoolFullRewrites: number;
  propPoolInstancesUploaded: number;
  propPoolPaddingInstances: number;
  propPoolPageWrites: number;
}

export class ProceduralTerrain {
  readonly object3d = new Group();
  private readonly materials: TerrainMaterials;
  private readonly pages = new Map<string, PresentedTerrainPage>();
  private readonly pagesAwaitingWrites = new Set<string>();
  private readonly presentationGroup = new Group();
  private groundTextureDetailEnabled = true;
  private groundTextureMaterial: TerrainMaterials["land"] | null = null;
  private groundTextureHandle: TerrainGroundTextureHandle | null = null;
  private groundTexturesPromise: Promise<TerrainGroundTextureHandle> | null = null;
  private propLod: TerrainPropLod = "near";
  private qualityTier: TerrainQualityTier = "detail";
  private propPools: TerrainPropPools | null = null;
  private propPoolsPromise: Promise<TerrainPropPools> | null = null;
  private propPoolFullRewrites = 0;
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

  /**
   * Builds the whole-window fog mask off-thread only when these pages move the fog window; page churn inside a
   * stable window is written as sub-rects at commit, so it resolves to null without a worker round trip.
   */
  prepareFogMaskAsync(preparedPages: readonly PreparedTerrainPage[]): Promise<TerrainFogMask | null> {
    this.requireActive();
    const cells = this.fogField.resolveIncomingFogCells(preparedPages.flatMap((page) => page.shroudInstances));
    if (!this.fogField.requiresMaskRebuild(cells)) return Promise.resolve(null);
    this.pageWorker ??= new TerrainPageWorkerClient();
    return this.pageWorker.prepareFogMask(cells);
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
      this.writeRetainedPagesToPools(pools);
    }
    pools.setLod(this.propLod);
    pools.setWindStrength(TERRAIN_QUALITY_PROFILES[this.qualityTier].windStrength);
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

  getUploadMetrics(): TerrainUploadMetrics {
    const props = this.propPools?.getMetrics() ?? { instancesUploaded: 0, pageWrites: 0, paddingInstances: 0 };
    const fog = this.fogField.getMetrics();
    return {
      fogMaskFullRebuilds: fog.fullRebuilds,
      fogMaskPageWrites: fog.pageWrites,
      fogMaskTexelsWritten: fog.texelsWritten,
      propPoolFullRewrites: this.propPoolFullRewrites,
      propPoolInstancesUploaded: props.instancesUploaded,
      propPoolPaddingInstances: props.paddingInstances,
      propPoolPageWrites: props.pageWrites,
    };
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

  /**
   * Presents exactly these pages in one call. Pages whose fingerprint is retained are untouched; changed pages
   * rewrite only their own geometry, prop slots, and fog sub-rects; dropped pages release theirs. The worldmap
   * runs the same three steps as separate frame-budget tasks so one page at a time reaches the main thread.
   */
  present(
    preparedPages: readonly PreparedTerrainPage[],
    preparedFogMask: TerrainFogMask | null = null,
  ): TerrainPresentationDiagnostics {
    this.beginPresentation(preparedPages);
    preparedPages.forEach((preparedPage) => this.presentPage(preparedPage));
    return this.finishPresentation(preparedPages, preparedFogMask);
  }

  /** Validates the page set and releases the pages it drops, freeing their prop slots and fog cells first. */
  beginPresentation(preparedPages: readonly PreparedTerrainPage[]): void {
    this.requireActive();
    requireUniquePageKeys(preparedPages);
    this.releaseDroppedPages(preparedPages);
  }

  /** Whether this page is already on screen with this fingerprint, so presenting it again is a no-op. */
  isPagePresented(preparedPage: PreparedTerrainPage): boolean {
    return this.pages.get(preparedPage.request.pageKey)?.fingerprint === preparedPage.fingerprint;
  }

  /** Adds or replaces one page: its old geometry leaves in the same step its new geometry arrives. */
  presentPage(preparedPage: PreparedTerrainPage): void {
    this.presentPageGeometry(preparedPage);
    this.presentPageWrites(preparedPage);
  }

  /** Swaps the page's meshes and field in; a separate step from the pool and fog writes so neither exceeds a frame budget. */
  presentPageGeometry(preparedPage: PreparedTerrainPage): void {
    this.requireActive();
    if (this.isPagePresented(preparedPage)) return;
    const pageKey = preparedPage.request.pageKey;
    const retained = this.pages.get(pageKey);
    if (retained) {
      this.presentationGroup.remove(retained.group);
      disposePageGeometry(retained);
    }
    const page = this.createPresentedPage(preparedPage);
    this.pages.set(pageKey, page);
    this.presentationGroup.add(page.group);
    this.pagesAwaitingWrites.add(pageKey);
  }

  /** Writes the prop slot and fog cells of a page whose geometry step ran; a no-op otherwise. */
  presentPageWrites(preparedPage: PreparedTerrainPage): void {
    this.requireActive();
    const pageKey = preparedPage.request.pageKey;
    const page = this.pages.get(pageKey);
    if (!page || page.fingerprint !== preparedPage.fingerprint || !this.pagesAwaitingWrites.delete(pageKey)) return;
    this.propPools?.writePage(pageKey, page.propInstances);
    this.fogField.setPage(pageKey, preparedPage.shroudInstances);
  }

  /** Commits the fog changes the page steps made and summarises the presented set. */
  finishPresentation(
    preparedPages: readonly PreparedTerrainPage[],
    preparedFogMask: TerrainFogMask | null = null,
  ): TerrainPresentationDiagnostics {
    this.requireActive();
    this.fogField.commit(preparedFogMask);
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
    this.pages.forEach(disposePageGeometry);
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

  private releaseDroppedPages(preparedPages: readonly PreparedTerrainPage[]): void {
    const retainedKeys = new Set(preparedPages.map((page) => page.request.pageKey));
    for (const [pageKey, page] of this.pages) {
      if (!retainedKeys.has(pageKey)) this.releasePage(pageKey, page);
    }
  }

  private releasePage(pageKey: string, page: PresentedTerrainPage): void {
    this.pagesAwaitingWrites.delete(pageKey);
    this.presentationGroup.remove(page.group);
    disposePageGeometry(page);
    this.pages.delete(pageKey);
    this.propPools?.releasePage(pageKey);
    this.fogField.removePage(pageKey);
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
    };
  }

  private writeRetainedPagesToPools(pools: TerrainPropPools): void {
    if (this.pages.size === 0) return;
    this.pages.forEach((page, pageKey) => pools.writePage(pageKey, page.propInstances));
    this.propPoolFullRewrites += 1;
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

function disposePageGeometry(page: PresentedTerrainPage): void {
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
