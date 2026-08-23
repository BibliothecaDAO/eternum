import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Sphere,
  Vector3,
} from "three";
import type UniformNode from "three/src/nodes/core/UniformNode.js";
import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  attribute,
  float,
  length,
  mix,
  positionGeometry,
  positionLocal,
  positionWorld,
  time,
  uniform,
  vec3,
} from "three/tsl";

import { terrainCellKey } from "./terrain-coordinates";
import type { TerrainShroudInstance } from "./terrain-types";

export const TERRAIN_SHROUD_POOL_CAPACITY = 12_288;
export const TERRAIN_SHROUD_REVEAL_DURATION_SECONDS = 0.9;

export interface TerrainShroudPoolStats {
  activeReveals: number;
  frontierInstances: number;
  instances: number;
  triangles: number;
}

interface ActiveReveal {
  elapsedSeconds: number;
  instance: TerrainShroudInstance;
}

interface ShroudMaterialSet {
  base: MeshStandardNodeMaterial;
  mistStrength: UniformNode<"float", number>;
  motionStrength: UniformNode<"float", number>;
}

const BASE_MESH_NAME = "terrain-exploration-shroud";
const FRONTIER_ATTRIBUTE = "terrainShroudFrontier";
const REVEAL_ATTRIBUTE = "terrainShroudReveal";
const SEED_ATTRIBUTE = "terrainShroudSeed";

export class TerrainShroudPools {
  readonly object3d = new Group();
  private readonly materials = createShroudMaterials();
  private readonly baseMesh = createShroudMesh(BASE_MESH_NAME, 1.2, 0.34, this.materials.base);
  private readonly activeReveals = new Map<string, ActiveReveal>();
  private readonly queuedReveals = new Set<string>();
  private readonly latestInstances = new Map<string, TerrainShroudInstance>();
  private readonly renderedInstances = new Map<string, TerrainShroudInstance>();
  private readonly matrix = new Matrix4();
  private readonly tint = new Color();
  private readonly position = new Vector3();
  private frontierInstances = 0;

  constructor() {
    this.object3d.name = "terrain-exploration-shroud-pools";
    this.object3d.add(this.baseMesh);
  }

  update(instances: readonly TerrainShroudInstance[]): void {
    requireShroudCapacity(instances.length);
    this.latestInstances.clear();
    instances.forEach((instance) => this.latestInstances.set(instanceKey(instance), instance));
    this.activateCommittedReveals();
    this.dropOrphanedQueuedReveals();
    this.refreshMeshes();
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
      if (reveal.elapsedSeconds >= TERRAIN_SHROUD_REVEAL_DURATION_SECONDS) {
        this.activeReveals.delete(key);
        completed = true;
      }
    });
    if (completed) this.refreshMeshes();
    else this.updateRevealAttributes();
  }

  setQuality(motionStrength: number, mistStrength: number): void {
    this.materials.motionStrength.value = clampUnit(motionStrength);
    this.materials.mistStrength.value = clampUnit(mistStrength);
  }

  getStats(): TerrainShroudPoolStats {
    const baseTriangles = geometryTriangles(this.baseMesh.geometry) * this.baseMesh.count;
    return {
      activeReveals: this.activeReveals.size,
      frontierInstances: this.frontierInstances,
      instances: this.baseMesh.count,
      triangles: baseTriangles,
    };
  }

  dispose(): void {
    this.baseMesh.geometry.dispose();
    this.baseMesh.dispose();
    this.materials.base.dispose();
    this.activeReveals.clear();
    this.queuedReveals.clear();
    this.latestInstances.clear();
    this.renderedInstances.clear();
    this.object3d.clear();
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

  private refreshMeshes(): void {
    this.renderedInstances.clear();
    this.latestInstances.forEach((instance, key) => this.renderedInstances.set(key, instance));
    this.activeReveals.forEach(({ instance }, key) => this.renderedInstances.set(key, instance));
    requireShroudCapacity(this.renderedInstances.size);
    const ordered = Array.from(this.renderedInstances.values()).toSorted(
      (left, right) => left.row - right.row || left.col - right.col,
    );
    this.frontierInstances = ordered.filter((instance) => instance.frontier).length;
    this.writeMeshInstances(this.baseMesh, ordered, 0);
  }

  private writeMeshInstances(
    mesh: InstancedMesh,
    instances: readonly TerrainShroudInstance[],
    heightOffset: number,
  ): void {
    const bounds = new Box3();
    const seedAttribute = mesh.geometry.getAttribute(SEED_ATTRIBUTE) as InstancedBufferAttribute;
    const revealAttribute = mesh.geometry.getAttribute(REVEAL_ATTRIBUTE) as InstancedBufferAttribute;
    const frontierAttribute = mesh.geometry.getAttribute(FRONTIER_ATTRIBUTE) as InstancedBufferAttribute;
    instances.forEach((instance, index) => {
      this.position.set(instance.worldX, instance.worldY + heightOffset, instance.worldZ);
      this.matrix.makeTranslation(this.position.x, this.position.y, this.position.z);
      mesh.setMatrixAt(index, this.matrix);
      this.tint.setRGB(...instance.tint);
      mesh.setColorAt(index, this.tint);
      seedAttribute.setX(index, instance.seed);
      revealAttribute.setX(index, this.resolveRevealProgress(instance));
      frontierAttribute.setX(index, instance.frontier ? 1 : 0);
      bounds.expandByPoint(this.position);
    });
    mesh.count = instances.length;
    markAttributeRangeForUpload(mesh.instanceMatrix, instances.length, 16);
    if (mesh.instanceColor) {
      mesh.instanceColor.setUsage(DynamicDrawUsage);
      markAttributeRangeForUpload(mesh.instanceColor, instances.length, 3);
    }
    markAttributeRangeForUpload(seedAttribute, instances.length, 1);
    markAttributeRangeForUpload(revealAttribute, instances.length, 1);
    markAttributeRangeForUpload(frontierAttribute, instances.length, 1);
    mesh.visible = instances.length > 0;
    if (instances.length > 0) {
      mesh.boundingSphere = bounds.getBoundingSphere(new Sphere());
      mesh.boundingSphere.radius += 1.5;
    }
  }

  private updateRevealAttributes(): void {
    this.updateMeshRevealAttribute(this.baseMesh);
  }

  private updateMeshRevealAttribute(mesh: InstancedMesh): void {
    const revealAttribute = mesh.geometry.getAttribute(REVEAL_ATTRIBUTE) as InstancedBufferAttribute;
    const keyByIndex = Array.from(this.renderedInstances.values()).toSorted(
      (left, right) => left.row - right.row || left.col - right.col,
    );
    keyByIndex.forEach((instance, index) => revealAttribute.setX(index, this.resolveRevealProgress(instance)));
    markAttributeRangeForUpload(revealAttribute, keyByIndex.length, 1);
  }

  private resolveRevealProgress(instance: TerrainShroudInstance): number {
    const reveal = this.activeReveals.get(instanceKey(instance));
    return reveal ? clampUnit(reveal.elapsedSeconds / TERRAIN_SHROUD_REVEAL_DURATION_SECONDS) : 0;
  }
}

function createShroudMesh(
  name: string,
  radius: number,
  skirtDepth: number,
  material: MeshStandardNodeMaterial,
): InstancedMesh {
  const geometry = createShroudGeometry(radius, skirtDepth);
  geometry.setAttribute(SEED_ATTRIBUTE, createDynamicInstanceAttribute());
  geometry.setAttribute(FRONTIER_ATTRIBUTE, createDynamicInstanceAttribute());
  geometry.setAttribute(REVEAL_ATTRIBUTE, createDynamicInstanceAttribute());
  const mesh = new InstancedMesh(geometry, material, TERRAIN_SHROUD_POOL_CAPACITY);
  mesh.name = name;
  mesh.count = 0;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.raycast = disableShroudRaycast;
  mesh.renderOrder = 4;
  return mesh;
}

function createDynamicInstanceAttribute(): InstancedBufferAttribute {
  const attribute = new InstancedBufferAttribute(new Float32Array(TERRAIN_SHROUD_POOL_CAPACITY), 1);
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}

function createShroudGeometry(radius: number, skirtDepth: number): BufferGeometry {
  const positions: number[] = [0, 0, 0];
  const indices: number[] = [];
  for (let corner = 0; corner < 6; corner += 1) {
    const angle = Math.PI / 6 + corner * (Math.PI / 3);
    positions.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }
  for (let corner = 0; corner < 6; corner += 1) indices.push(0, corner + 1, ((corner + 1) % 6) + 1);
  if (skirtDepth > 0) {
    const bottomStart = positions.length / 3;
    for (let corner = 0; corner < 6; corner += 1) {
      const angle = Math.PI / 6 + corner * (Math.PI / 3);
      positions.push(Math.cos(angle) * radius, -skirtDepth, Math.sin(angle) * radius);
    }
    for (let corner = 0; corner < 6; corner += 1) {
      const topA = corner + 1;
      const topB = ((corner + 1) % 6) + 1;
      const bottomA = bottomStart + corner;
      const bottomB = bottomStart + ((corner + 1) % 6);
      indices.push(topA, topB, bottomA, bottomA, topB, bottomB);
    }
  }
  const geometry = new BufferGeometry();
  geometry.name = "terrain-exploration-shroud-geometry";
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createShroudMaterials(): ShroudMaterialSet {
  const motionStrength = uniform(1, "float");
  const mistStrength = uniform(1, "float");
  const base = createBaseShroudMaterial(motionStrength, mistStrength);
  return { base, mistStrength, motionStrength };
}

function createBaseShroudMaterial(
  motionStrength: UniformNode<"float", number>,
  mistStrength: UniformNode<"float", number>,
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 1, side: DoubleSide, vertexColors: true });
  material.name = "terrain-exploration-shroud-base";
  const seed = attribute<"float">(SEED_ATTRIBUTE, "float");
  const frontier = attribute<"float">(FRONTIER_ATTRIBUTE, "float");
  const reveal = attribute<"float">(REVEAL_ATTRIBUTE, "float");
  const flow = positionWorld.x
    .mul(0.19)
    .add(positionWorld.z.mul(0.13))
    .add(seed.mul(7.31))
    .add(time.mul(0.065).mul(motionStrength));
  const colorFlow = flow.sin().mul(0.045).add(0.98).add(frontier.mul(mistStrength).mul(0.08));
  const localRadius = length(positionGeometry.xz).div(1.2);
  const organicEdge = localRadius
    .add(flow.mul(1.52).sin().mul(0.11))
    .add(flow.mul(-0.91).add(seed.mul(5.1)).sin().mul(0.055));
  const instanceTint = attribute<"vec3">("instanceColor", "vec3");
  material.colorNode = instanceTint.mul(colorFlow).mul(0.35);
  material.emissiveNode = instanceTint.mul(0.68).add(instanceTint.mul(frontier).mul(mistStrength).mul(0.12));
  const boundaryLimit = mix(1.5, 1.015, frontier);
  material.maskNode = organicEdge.lessThan(boundaryLimit).and(organicEdge.greaterThan(reveal.mul(1.35).sub(0.2)));
  const wave = flow
    .sin()
    .mul(0.012)
    .mul(motionStrength)
    .mul(float(1).sub(reveal))
    .mul(frontier.mul(mistStrength).add(0.35));
  material.positionNode = positionLocal.add(vec3(0, wave, 0));
  return material;
}

function requireShroudCapacity(count: number): void {
  if (count > TERRAIN_SHROUD_POOL_CAPACITY) {
    throw new Error(`Terrain exploration shroud exceeded ${TERRAIN_SHROUD_POOL_CAPACITY} instances`);
  }
}

function instanceKey(instance: Pick<TerrainShroudInstance, "col" | "row">): string {
  return terrainCellKey(instance.col, instance.row);
}

function geometryTriangles(geometry: BufferGeometry): number {
  return (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
}

function markAttributeRangeForUpload(attribute: BufferAttribute, instanceCount: number, itemSize: number): void {
  attribute.clearUpdateRanges();
  if (instanceCount === 0) return;
  attribute.addUpdateRange(0, instanceCount * itemSize);
  attribute.needsUpdate = true;
}

function disableShroudRaycast(raycaster: unknown, intersects: unknown[]): void {
  void raycaster;
  void intersects;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
