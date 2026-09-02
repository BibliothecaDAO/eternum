import {
  ClampToEdgeWrapping,
  DataTexture,
  Group,
  LinearFilter,
  Mesh,
  PlaneGeometry,
  RedFormat,
  UnsignedByteType,
} from "three";
import type MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";
import type TextureNode from "three/src/nodes/accessors/TextureNode.js";
import type UniformNode from "three/src/nodes/core/UniformNode.js";
import * as ThreeWebGPU from "three/webgpu";
import { color, float, mix, positionWorld, smoothstep, texture, time, uniform, uv } from "three/tsl";

import { terrainCellKey } from "./terrain-coordinates";
import {
  applyTerrainFogReveals,
  buildTerrainFogMask,
  isSameTerrainFogMaskLayout,
  resolveTerrainFogInfluence,
  resolveTerrainFogMaskLayout,
  writeTerrainFogMaskRegion,
  type TerrainFogMask,
  type TerrainFogMaskBounds,
  type TerrainFogMaskLayout,
} from "./terrain-fog-mask";
import { TERRAIN_DEEP_FOG_COLOR, TERRAIN_DEEP_FOG_OPACITY } from "./terrain-fog-style";
import type { TerrainShroudInstance } from "./terrain-types";

export const TERRAIN_FOG_CELL_CAPACITY = 12_288;
export const TERRAIN_FOG_REVEAL_DURATION_SECONDS = 0.25;

export interface TerrainFogFieldStats {
  activeReveals: number;
  frontierInstances: number;
  instances: number;
  maskBytes: number;
  maskHeight: number;
  maskWidth: number;
  triangles: number;
}

export interface TerrainFogMaskMetrics {
  /** Whole-window mask builds: the fog window moved, or the first fog appeared. */
  fullRebuilds: number;
  /** Sub-rect writes: a changed page or a completed reveal re-rasterised only its own area. */
  pageWrites: number;
  texelsWritten: number;
}

interface ActiveReveal {
  elapsedSeconds: number;
  instance: TerrainShroudInstance;
}

interface FogMaterialSet {
  material: MeshBasicNodeMaterial;
  maskTexture: TextureNode;
  mistStrength: UniformNode<"float", number>;
  motionStrength: UniformNode<"float", number>;
}

const FOG_MESH_NAME = "terrain-exploration-fog-field";
const FOG_PLANE_HEIGHT = 0.24;
const MeshBasicNodeMaterialConstructor = (
  ThreeWebGPU as unknown as { MeshBasicNodeMaterial: new () => MeshBasicNodeMaterial }
).MeshBasicNodeMaterial;

/**
 * One mist sheet over every unexplored cell of the presented pages. Pages hand in their shroud cells; a commit
 * rebuilds the whole distance mask only when the fog window moves and otherwise re-rasterises the sub-rects the
 * changed pages (or completed reveals) touched.
 */
export class TerrainFogField {
  readonly object3d = new Group();
  private textureData = new Uint8Array(1);
  private maskTexture = createFogMaskTexture(this.textureData, 1, 1);
  private maskTextureHeight = 1;
  private maskTextureWidth = 1;
  private readonly materials = createFogMaterial(this.maskTexture);
  private readonly fogMesh = createFogMesh(this.materials.material);
  private readonly pages = new Map<string, readonly TerrainShroudInstance[]>();
  private readonly renderedInstances = new Map<string, TerrainShroudInstance>();
  private readonly activeReveals = new Map<string, ActiveReveal>();
  private readonly queuedReveals = new Set<string>();
  private readonly dirtyRegions: TerrainFogMaskBounds[] = [];
  private readonly metrics: TerrainFogMaskMetrics = { fullRebuilds: 0, pageWrites: 0, texelsWritten: 0 };
  private mask: TerrainFogMask | null = null;
  private frontierInstances = 0;

  constructor() {
    this.object3d.name = "terrain-exploration-fog-field";
    this.object3d.add(this.fogMesh);
  }

  setPage(pageKey: string, instances: readonly TerrainShroudInstance[]): void {
    const previous = this.pages.get(pageKey) ?? [];
    const nextByKey = new Map(instances.map((instance) => [instanceKey(instance), instance]));
    previous.forEach((instance) => {
      if (!nextByKey.has(instanceKey(instance))) this.releasePageCell(instance);
    });
    instances.forEach((instance) => this.renderPageCell(instance));
    this.pages.set(pageKey, instances);
    requireFogCapacity(this.renderedInstances.size);
    this.markDirty(resolveChangedFogCells(previous, nextByKey));
  }

  removePage(pageKey: string): void {
    this.setPage(pageKey, []);
    this.pages.delete(pageKey);
  }

  /** Applies the page changes since the last commit; `preparedMask` is adopted only if it fits the new window. */
  commit(preparedMask: TerrainFogMask | null = null): void {
    const layout = resolveTerrainFogMaskLayout(this.renderedInstances.values());
    if (!layout) {
      this.mask = null;
      this.dirtyRegions.length = 0;
      this.fogMesh.visible = false;
      return;
    }
    if (this.mask && isSameTerrainFogMaskLayout(this.mask, layout)) this.writeDirtyRegions(this.mask);
    else this.rebuildMask(layout, preparedMask);
    this.uploadFogMask();
  }

  /** The cells the next commit will render for these incoming pages, including cells held back by pending reveals. */
  resolveIncomingFogCells(instances: readonly TerrainShroudInstance[]): TerrainShroudInstance[] {
    const incoming = new Map(instances.map((instance) => [instanceKey(instance), instance]));
    this.queuedReveals.forEach((key) => retainFogCell(incoming, this.renderedInstances, key));
    this.activeReveals.forEach((_reveal, key) => retainFogCell(incoming, this.renderedInstances, key));
    requireFogCapacity(incoming.size);
    return Array.from(incoming.values());
  }

  requiresMaskRebuild(instances: readonly TerrainShroudInstance[]): boolean {
    const layout = resolveTerrainFogMaskLayout(instances);
    return layout !== null && (!this.mask || !isSameTerrainFogMaskLayout(this.mask, layout));
  }

  queueReveal(col: number, row: number): void {
    const key = terrainCellKey(col, row);
    if (this.renderedInstances.has(key)) this.queuedReveals.add(key);
  }

  updateAnimation(deltaSeconds: number): void {
    if (this.activeReveals.size === 0) return;
    const boundedDelta = Math.min(0.05, Math.max(0, deltaSeconds));
    const completed: TerrainShroudInstance[] = [];
    this.activeReveals.forEach((reveal, key) => {
      reveal.elapsedSeconds += boundedDelta;
      if (reveal.elapsedSeconds < TERRAIN_FOG_REVEAL_DURATION_SECONDS) return;
      this.activeReveals.delete(key);
      completed.push(reveal.instance);
    });
    if (completed.length === 0) {
      this.uploadFogMask();
      return;
    }
    completed.forEach((instance) => this.releaseRenderedCell(instance));
    this.markDirty(completed);
    this.commit();
  }

  setQuality(motionStrength: number, mistStrength: number): void {
    this.materials.motionStrength.value = clampUnit(motionStrength);
    this.materials.mistStrength.value = clampUnit(mistStrength);
  }

  getStats(): TerrainFogFieldStats {
    return {
      activeReveals: this.activeReveals.size,
      frontierInstances: this.frontierInstances,
      instances: this.renderedInstances.size,
      maskBytes: this.mask ? this.textureData.byteLength : 0,
      maskHeight: this.mask?.height ?? 0,
      maskWidth: this.mask?.width ?? 0,
      triangles: this.fogMesh.visible ? 2 : 0,
    };
  }

  getMetrics(): TerrainFogMaskMetrics {
    return { ...this.metrics };
  }

  dispose(): void {
    this.fogMesh.geometry.dispose();
    this.materials.material.dispose();
    this.maskTexture.dispose();
    this.activeReveals.clear();
    this.queuedReveals.clear();
    this.pages.clear();
    this.renderedInstances.clear();
    this.dirtyRegions.length = 0;
    this.object3d.clear();
    this.mask = null;
  }

  private renderPageCell(instance: TerrainShroudInstance): void {
    const key = instanceKey(instance);
    this.activeReveals.delete(key);
    this.releaseRenderedCell(instance);
    this.renderedInstances.set(key, instance);
    if (instance.frontier) this.frontierInstances += 1;
  }

  private releasePageCell(instance: TerrainShroudInstance): void {
    const key = instanceKey(instance);
    if (!this.queuedReveals.has(key)) {
      this.releaseRenderedCell(instance);
      return;
    }
    // The cell stays rendered while its reveal animates it away.
    this.queuedReveals.delete(key);
    this.activeReveals.set(key, { elapsedSeconds: 0, instance });
  }

  private releaseRenderedCell(instance: TerrainShroudInstance): void {
    const key = instanceKey(instance);
    const rendered = this.renderedInstances.get(key);
    if (!rendered) return;
    this.renderedInstances.delete(key);
    if (rendered.frontier) this.frontierInstances -= 1;
  }

  private markDirty(instances: readonly TerrainShroudInstance[]): void {
    const region = resolveTerrainFogInfluence(instances);
    if (region) this.dirtyRegions.push(region);
  }

  private rebuildMask(layout: TerrainFogMaskLayout, preparedMask: TerrainFogMask | null): void {
    const prepared = preparedMask && isSameTerrainFogMaskLayout(preparedMask, layout) ? preparedMask : null;
    this.mask = prepared ?? buildTerrainFogMask(Array.from(this.renderedInstances.values()));
    this.dirtyRegions.length = 0;
    this.metrics.fullRebuilds += 1;
    this.positionFogMesh(layout.bounds);
  }

  private writeDirtyRegions(mask: TerrainFogMask): void {
    for (const region of this.dirtyRegions) {
      this.metrics.texelsWritten += writeTerrainFogMaskRegion(mask, this.renderedInstances.values(), region);
      this.metrics.pageWrites += 1;
    }
    this.dirtyRegions.length = 0;
  }

  private positionFogMesh({ maxX, maxZ, minX, minZ }: TerrainFogMaskBounds): void {
    this.fogMesh.position.set((minX + maxX) / 2, FOG_PLANE_HEIGHT, (minZ + maxZ) / 2);
    this.fogMesh.scale.set(maxX - minX, 1, maxZ - minZ);
    this.fogMesh.visible = true;
  }

  private uploadFogMask(): void {
    if (!this.mask) return;
    this.resizeFogMaskTexture(this.mask.width, this.mask.height);
    const reveals = Array.from(this.activeReveals.values(), ({ elapsedSeconds, instance }) => ({
      instance,
      progress: clampUnit(elapsedSeconds / TERRAIN_FOG_REVEAL_DURATION_SECONDS),
    }));
    applyTerrainFogReveals(this.mask, reveals, this.textureData);
    this.maskTexture.needsUpdate = true;
  }

  private resizeFogMaskTexture(width: number, height: number): void {
    if (this.maskTextureWidth === width && this.maskTextureHeight === height) return;
    const previousTexture = this.maskTexture;
    this.textureData = new Uint8Array(width * height);
    this.maskTexture = createFogMaskTexture(this.textureData, width, height);
    this.maskTextureWidth = width;
    this.maskTextureHeight = height;
    this.materials.maskTexture.value = this.maskTexture;
    previousTexture.dispose();
  }
}

function createFogMaskTexture(data: Uint8Array, width: number, height: number): DataTexture {
  const mask = new DataTexture(data, width, height, RedFormat, UnsignedByteType);
  mask.name = "terrain-exploration-fog-mask";
  mask.minFilter = LinearFilter;
  mask.magFilter = LinearFilter;
  mask.wrapS = ClampToEdgeWrapping;
  mask.wrapT = ClampToEdgeWrapping;
  mask.flipY = true;
  mask.generateMipmaps = false;
  mask.needsUpdate = true;
  return mask;
}

function createFogMaterial(maskTexture: DataTexture): FogMaterialSet {
  const motionStrength = uniform(1, "float");
  const mistStrength = uniform(1, "float");
  const material = new MeshBasicNodeMaterialConstructor();
  material.name = "terrain-exploration-mist";
  material.transparent = true;
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;

  const primaryFlow = positionWorld.x
    .mul(0.095)
    .add(positionWorld.z.mul(0.061))
    .add(time.mul(0.024).mul(motionStrength));
  const crossFlow = positionWorld.x
    .mul(-0.047)
    .add(positionWorld.z.mul(0.113))
    .sub(time.mul(0.017).mul(motionStrength));
  const detailFlow = positionWorld.x
    .mul(0.181)
    .add(positionWorld.z.mul(-0.157))
    .add(time.mul(0.011).mul(motionStrength));
  const mistNoise = primaryFlow.sin().mul(0.2).add(crossFlow.sin().mul(0.2)).add(detailFlow.sin().mul(0.1)).add(0.5);
  const maskTextureNode = texture(maskTexture, uv());
  const mask = maskTextureNode.r;
  const edgeBand = smoothstep(0.08, 0.54, mask).mul(float(1).sub(smoothstep(0.58, 0.96, mask)));
  const cloudVeil = smoothstep(0.25, 0.76, mistNoise).mul(mistStrength).mul(0.2);
  const edgeLight = edgeBand.mul(mistStrength).mul(0.16).add(cloudVeil);
  material.colorNode = mix(color(TERRAIN_DEEP_FOG_COLOR), color("#7d8882"), edgeLight.clamp(0, 0.36));
  const opacityMotion = mistNoise.sub(0.5).mul(mistStrength).mul(0.1).add(0.94);
  const frontierOpacity = mask.mul(opacityMotion).clamp(0, TERRAIN_DEEP_FOG_OPACITY);
  const deepFog = smoothstep(0.9, 0.985, mask);
  material.opacityNode = mix(frontierOpacity, float(TERRAIN_DEEP_FOG_OPACITY), deepFog);
  return {
    material,
    maskTexture: maskTextureNode,
    mistStrength,
    motionStrength,
  };
}

function createFogMesh(material: MeshBasicNodeMaterial): Mesh<PlaneGeometry, MeshBasicNodeMaterial> {
  const geometry = new PlaneGeometry(1, 1, 1, 1);
  geometry.name = "terrain-exploration-fog-sheet-geometry";
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, material);
  mesh.name = FOG_MESH_NAME;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 10_000;
  mesh.raycast = disableFogRaycast;
  mesh.visible = false;
  return mesh;
}

/** The cells whose mask contribution differs between a page's previous and next shroud, old and new alike. */
function resolveChangedFogCells(
  previous: readonly TerrainShroudInstance[],
  nextByKey: ReadonlyMap<string, TerrainShroudInstance>,
): TerrainShroudInstance[] {
  const changed: TerrainShroudInstance[] = [];
  const unchangedKeys = new Set<string>();
  for (const instance of previous) {
    const key = instanceKey(instance);
    const next = nextByKey.get(key);
    if (next && isSameFogCell(instance, next)) unchangedKeys.add(key);
    else changed.push(instance);
  }
  nextByKey.forEach((instance, key) => {
    if (!unchangedKeys.has(key)) changed.push(instance);
  });
  return changed;
}

function isSameFogCell(left: TerrainShroudInstance, right: TerrainShroudInstance): boolean {
  return (
    left.frontier === right.frontier &&
    left.frontierDirection[0] === right.frontierDirection[0] &&
    left.frontierDirection[1] === right.frontierDirection[1] &&
    left.worldX === right.worldX &&
    left.worldZ === right.worldZ
  );
}

function retainFogCell(
  incoming: Map<string, TerrainShroudInstance>,
  rendered: ReadonlyMap<string, TerrainShroudInstance>,
  key: string,
): void {
  if (incoming.has(key)) return;
  const retained = rendered.get(key);
  if (retained) incoming.set(key, retained);
}

function requireFogCapacity(count: number): void {
  if (count > TERRAIN_FOG_CELL_CAPACITY) {
    throw new Error(`Terrain exploration fog exceeded ${TERRAIN_FOG_CELL_CAPACITY} cells`);
  }
}

function instanceKey(instance: Pick<TerrainShroudInstance, "col" | "row">): string {
  return terrainCellKey(instance.col, instance.row);
}

function disableFogRaycast(raycaster: unknown, intersects: unknown[]): void {
  void raycaster;
  void intersects;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
