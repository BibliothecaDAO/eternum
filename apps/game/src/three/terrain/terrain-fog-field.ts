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
import { applyTerrainFogReveals, buildTerrainFogMask, type TerrainFogMask } from "./terrain-fog-mask";
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

export class TerrainFogField {
  readonly object3d = new Group();
  private textureData = new Uint8Array(1);
  private maskTexture = createFogMaskTexture(this.textureData, 1, 1);
  private maskTextureHeight = 1;
  private maskTextureWidth = 1;
  private readonly materials = createFogMaterial(this.maskTexture);
  private readonly fogMesh = createFogMesh(this.materials.material);
  private readonly activeReveals = new Map<string, ActiveReveal>();
  private readonly queuedReveals = new Set<string>();
  private readonly latestInstances = new Map<string, TerrainShroudInstance>();
  private readonly renderedInstances = new Map<string, TerrainShroudInstance>();
  private mask: TerrainFogMask | null = null;
  private frontierInstances = 0;

  constructor() {
    this.object3d.name = "terrain-exploration-fog-field";
    this.object3d.add(this.fogMesh);
  }

  update(instances: readonly TerrainShroudInstance[], preparedMask?: TerrainFogMask | null): void {
    requireFogCapacity(instances.length);
    this.latestInstances.clear();
    instances.forEach((instance) => this.latestInstances.set(instanceKey(instance), instance));
    this.activateCommittedReveals();
    this.dropOrphanedQueuedReveals();
    this.refreshFogField(preparedMask);
  }

  resolveIncomingFogCells(instances: readonly TerrainShroudInstance[]): TerrainShroudInstance[] {
    const incoming = new Map(instances.map((instance) => [instanceKey(instance), instance]));
    this.queuedReveals.forEach((key) => retainFogCell(incoming, this.renderedInstances, key));
    this.activeReveals.forEach((_reveal, key) => retainFogCell(incoming, this.renderedInstances, key));
    requireFogCapacity(incoming.size);
    return Array.from(incoming.values()).toSorted((left, right) => left.row - right.row || left.col - right.col);
  }

  queueReveal(col: number, row: number): void {
    const key = terrainCellKey(col, row);
    if (this.renderedInstances.has(key)) this.queuedReveals.add(key);
  }

  updateAnimation(deltaSeconds: number): void {
    if (this.activeReveals.size === 0) return;
    const boundedDelta = Math.min(0.05, Math.max(0, deltaSeconds));
    let completed = false;
    this.activeReveals.forEach((reveal, key) => {
      reveal.elapsedSeconds += boundedDelta;
      if (reveal.elapsedSeconds >= TERRAIN_FOG_REVEAL_DURATION_SECONDS) {
        this.activeReveals.delete(key);
        completed = true;
      }
    });
    if (completed) this.refreshFogField();
    else this.uploadFogMask();
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

  dispose(): void {
    this.fogMesh.geometry.dispose();
    this.materials.material.dispose();
    this.maskTexture.dispose();
    this.activeReveals.clear();
    this.queuedReveals.clear();
    this.latestInstances.clear();
    this.renderedInstances.clear();
    this.object3d.clear();
    this.mask = null;
  }

  private activateCommittedReveals(): void {
    this.queuedReveals.forEach((key) => {
      if (this.latestInstances.has(key)) return;
      const instance = this.renderedInstances.get(key);
      if (!instance) return;
      this.activeReveals.set(key, { elapsedSeconds: 0, instance });
      this.queuedReveals.delete(key);
    });
  }

  private dropOrphanedQueuedReveals(): void {
    this.queuedReveals.forEach((key) => {
      if (!this.latestInstances.has(key) && !this.renderedInstances.has(key)) this.queuedReveals.delete(key);
    });
  }

  private refreshFogField(preparedMask?: TerrainFogMask | null): void {
    this.renderedInstances.clear();
    this.latestInstances.forEach((instance, key) => this.renderedInstances.set(key, instance));
    this.activeReveals.forEach(({ instance }, key) => this.renderedInstances.set(key, instance));
    requireFogCapacity(this.renderedInstances.size);
    const ordered = Array.from(this.renderedInstances.values()).toSorted(
      (left, right) => left.row - right.row || left.col - right.col,
    );
    this.frontierInstances = ordered.filter((instance) => instance.frontier).length;
    this.mask = preparedMask === undefined ? buildTerrainFogMask(ordered) : preparedMask;
    this.positionFogMesh();
    this.uploadFogMask();
  }

  private positionFogMesh(): void {
    if (!this.mask) {
      this.fogMesh.visible = false;
      return;
    }
    const { maxX, maxZ, minX, minZ } = this.mask.bounds;
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
