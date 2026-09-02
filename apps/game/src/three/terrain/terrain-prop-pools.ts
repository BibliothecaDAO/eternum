import {
  Box3,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Sphere,
  Vector3,
  type BufferAttribute,
} from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  attribute,
  color,
  mix,
  normalGeometry,
  positionGeometry,
  positionLocal,
  smoothstep,
  time,
  uniform,
  vec3,
  vertexColor,
} from "three/tsl";
import type UniformNode from "three/src/nodes/core/UniformNode.js";

import { WORLD_CHUNK_CONFIG } from "../constants/world-chunk-config";
import { loadTerrainPropCatalog } from "./terrain-prop-asset-cache";
import {
  TERRAIN_PROP_ARCHETYPE_IDS,
  getTerrainPropRole,
  getTerrainPropMeshName,
  isTerrainGroundCover,
  isTerrainPropVisibleAtLod,
  type TerrainPropArchetypeId,
  type TerrainPropLod,
} from "./terrain-prop-catalog";
import type { TerrainPropInstance } from "./terrain-types";

/** Every pool holds one fixed sub-range per visual page the worldmap can compose at once. */
export const TERRAIN_PROP_POOL_PAGE_SLOTS = WORLD_CHUNK_CONFIG.visualPresentation.maxCompositePages;

/**
 * Instances one 24×24 page may hold per archetype: 1.5× the measured per-page maximum, rounded up to a multiple of
 * 16. Measured 2026-09-02 at production density over the balanced benchmark fixture (144 pages), homogeneous
 * 3×3-page blocks of every biome, and eight climate seed pairs; `terrain-prop-pool-capacity.test.ts` re-measures
 * the fixtures against this table, so a density retune shows up there rather than as a live overflow.
 */
export const TERRAIN_PROP_PAGE_SLOT_CAPACITY: Readonly<Record<TerrainPropArchetypeId, number>> = Object.freeze({
  birch: 336, // measured 220
  boulder: 240, // measured 158
  broadleaf: 624, // measured 416
  cactus: 272, // measured 171
  conifer: 560, // measured 371
  "dead-tree": 144, // measured 88
  "fallen-log": 96, // measured 64
  fern: 160, // measured 98
  "grass-tuft": 112, // measured 66
  palm: 352, // measured 229
  reed: 80, // measured 44
  shrub: 464, // measured 306
  stump: 112, // measured 72
  wildflower: 64, // measured 37
  willow: 368, // measured 239
});

const TERRAIN_PROP_ECOLOGY_ATTRIBUTE = "terrainPropEcology";
const MATRIX_FLOATS = 16;
const VEC3_FLOATS = 3;
const EMPTY_INSTANCES: readonly TerrainPropInstance[] = Object.freeze([]);
// Slot tails and released slots stay in the drawn prefix; a zero scale collapses them to nothing.
const ZERO_SCALE_MATRIX = new Matrix4().makeScale(0, 0, 0);

export interface TerrainPropPoolStats {
  groundCoverInstances: number;
  instances: number;
  triangles: number;
}

export interface TerrainPropPoolMetrics {
  /** Instance matrices uploaded by page writes, including the zeroed tails of shrinking slots. */
  instancesUploaded: number;
  pageWrites: number;
  /** Zero-scaled instances inside the drawn prefix right now: the vertex cost of fixed slots. */
  paddingInstances: number;
}

interface PropPoolSlot {
  bounds: Box3;
  count: number;
  pageKey: string | null;
  radius: number;
}

interface PropPool {
  catalogRadius: number;
  ecology: InstancedBufferAttribute;
  mesh: InstancedMesh;
  slotCapacity: number;
  slots: PropPoolSlot[];
}

export class TerrainPropPools {
  readonly object3d = new Group();
  private readonly pools = new Map<TerrainPropArchetypeId, PropPool>();
  private readonly rigidMaterial = createTerrainPropMaterial(false);
  private readonly windStrength = uniform(1, "float");
  private readonly windMaterial = createTerrainPropMaterial(true, this.windStrength);
  private readonly matrix = new Matrix4();
  private readonly tint = new Color();
  private readonly position = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly scale = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly extent = new Box3();
  private readonly metrics = { instancesUploaded: 0, pageWrites: 0 };
  private lod: TerrainPropLod = "near";

  private constructor(private readonly catalogScene: Group) {
    this.object3d.name = "terrain-prop-pools";
    this.rigidMaterial.name = "terrain-props-rigid";
    this.windMaterial.name = "terrain-props-wind";
    TERRAIN_PROP_ARCHETYPE_IDS.forEach((archetype) => this.createPool(archetype));
  }

  static async load(): Promise<TerrainPropPools> {
    const catalog = await loadTerrainPropCatalog();
    return new TerrainPropPools(catalog.scene);
  }

  /** Writes one page's props into its slot of every archetype pool; only those sub-ranges are uploaded. */
  writePage(pageKey: string, instances: readonly TerrainPropInstance[]): void {
    const instancesByArchetype = groupByArchetype(instances);
    for (const archetype of TERRAIN_PROP_ARCHETYPE_IDS) {
      this.writePageSlot(archetype, pageKey, instancesByArchetype.get(archetype) ?? EMPTY_INSTANCES);
    }
    this.metrics.pageWrites += 1;
  }

  releasePage(pageKey: string): void {
    for (const archetype of TERRAIN_PROP_ARCHETYPE_IDS) this.writePageSlot(archetype, pageKey, EMPTY_INSTANCES);
  }

  setLod(lod: TerrainPropLod): void {
    if (lod === this.lod) return;
    this.lod = lod;
    this.windStrength.value = lod === "near" ? 1 : 0.35;
    this.pools.forEach((pool, archetype) => {
      pool.mesh.geometry = this.requireCatalogMesh(archetype, lod).geometry;
      pool.mesh.visible = pool.mesh.count > 0 && isTerrainPropVisibleAtLod(archetype, lod);
    });
  }

  setWindStrength(strength: number): void {
    this.windStrength.value = Math.min(1, Math.max(0, strength));
  }

  getStats(): TerrainPropPoolStats {
    let instances = 0;
    let groundCoverInstances = 0;
    let triangles = 0;
    this.pools.forEach((pool, archetype) => {
      if (!pool.mesh.visible) return;
      const count = countPoolInstances(pool);
      const geometry = pool.mesh.geometry;
      const sourceTriangles = (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
      instances += count;
      if (isTerrainGroundCover(archetype)) groundCoverInstances += count;
      triangles += sourceTriangles * count;
    });
    return { groundCoverInstances, instances, triangles };
  }

  getMetrics(): TerrainPropPoolMetrics {
    let paddingInstances = 0;
    this.pools.forEach((pool) => {
      if (pool.mesh.visible) paddingInstances += pool.mesh.count - countPoolInstances(pool);
    });
    return { ...this.metrics, paddingInstances };
  }

  dispose(): void {
    this.pools.forEach((pool, archetype) => {
      for (const lod of ["near", "far"] as const) {
        const geometry = this.requireCatalogMesh(archetype, lod).geometry;
        if (geometry.getAttribute(TERRAIN_PROP_ECOLOGY_ATTRIBUTE) === pool.ecology) {
          geometry.deleteAttribute(TERRAIN_PROP_ECOLOGY_ATTRIBUTE);
        }
      }
      pool.mesh.dispose();
    });
    this.pools.clear();
    this.object3d.clear();
    this.rigidMaterial.dispose();
    this.windMaterial.dispose();
  }

  private createPool(archetype: TerrainPropArchetypeId): void {
    const slotCapacity = TERRAIN_PROP_PAGE_SLOT_CAPACITY[archetype];
    const capacity = slotCapacity * TERRAIN_PROP_POOL_PAGE_SLOTS;
    const ecology = new InstancedBufferAttribute(new Float32Array(capacity * VEC3_FLOATS), VEC3_FLOATS);
    ecology.setUsage(DynamicDrawUsage);
    for (const lod of ["near", "far"] as const) {
      this.requireCatalogMesh(archetype, lod).geometry.setAttribute(TERRAIN_PROP_ECOLOGY_ATTRIBUTE, ecology);
    }
    const source = this.requireCatalogMesh(archetype, this.lod);
    const material = getTerrainPropRole(archetype) === "rigid" ? this.rigidMaterial : this.windMaterial;
    const mesh = new InstancedMesh(source.geometry, material, capacity);
    mesh.name = `terrain-prop-pool:${archetype}`;
    mesh.count = 0;
    mesh.visible = false;
    // A full-screen forest otherwise submits every prop geometry again to the
    // shadow pass. The ground and structures retain authored shadows.
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.raycast = disablePropRaycast;
    this.pools.set(archetype, {
      catalogRadius: this.resolveMaximumCatalogMeshRadius(archetype),
      ecology,
      mesh,
      slotCapacity,
      slots: Array.from({ length: TERRAIN_PROP_POOL_PAGE_SLOTS }, createEmptySlot),
    });
    this.object3d.add(mesh);
  }

  private writePageSlot(
    archetype: TerrainPropArchetypeId,
    pageKey: string,
    instances: readonly TerrainPropInstance[],
  ): void {
    const pool = this.requirePool(archetype);
    const slotIndex = instances.length > 0 ? acquireSlot(pool, archetype, pageKey) : findSlot(pool, pageKey);
    if (slotIndex === -1) return;
    requireSlotCapacity(pool, archetype, pageKey, instances.length);
    const slot = pool.slots[slotIndex];
    const start = slotIndex * pool.slotCapacity;
    this.metrics.instancesUploaded += this.writeSlotInstances(pool, archetype, start, slot, instances);
    slot.count = instances.length;
    slot.pageKey = instances.length > 0 ? pageKey : null;
    this.refreshPoolExtent(pool, archetype);
  }

  /** Writes the instances from the slot start, zeroes the tail the slot previously used, and queues the uploads. */
  private writeSlotInstances(
    pool: PropPool,
    archetype: TerrainPropArchetypeId,
    start: number,
    slot: PropPoolSlot,
    instances: readonly TerrainPropInstance[],
  ): number {
    const { mesh } = pool;
    const source = this.requireCatalogMesh(archetype, this.lod);
    source.updateMatrix();
    slot.bounds.makeEmpty();
    slot.radius = 0;
    instances.forEach((instance, offset) => {
      const index = start + offset;
      this.position.set(instance.worldX, instance.worldY, instance.worldZ);
      slot.bounds.expandByPoint(this.position);
      this.quaternion.setFromAxisAngle(this.up, instance.yaw);
      this.scale.setScalar(instance.scale);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.matrix.multiply(source.matrix);
      mesh.setMatrixAt(index, this.matrix);
      this.tint.setRGB(...instance.appearance.tint);
      mesh.setColorAt(index, this.tint);
      pool.ecology.setXYZ(index, instance.appearance.windAmplitude, instance.appearance.moss, instance.appearance.snow);
      slot.radius = Math.max(slot.radius, pool.catalogRadius * instance.scale);
    });
    for (let index = start + instances.length; index < start + slot.count; index += 1) {
      mesh.setMatrixAt(index, ZERO_SCALE_MATRIX);
    }
    const written = Math.max(instances.length, slot.count);
    if (written === 0) return 0;
    uploadSubRange(mesh.instanceMatrix, start, written, MATRIX_FLOATS);
    if (instances.length > 0) {
      uploadSubRange(requireInstanceColor(mesh), start, instances.length, VEC3_FLOATS);
      uploadSubRange(pool.ecology, start, instances.length, VEC3_FLOATS);
    }
    return written;
  }

  private refreshPoolExtent(pool: PropPool, archetype: TerrainPropArchetypeId): void {
    let count = 0;
    let radius = 0;
    this.extent.makeEmpty();
    pool.slots.forEach((slot, index) => {
      if (slot.count === 0) return;
      count = index * pool.slotCapacity + slot.count;
      radius = Math.max(radius, slot.radius);
      this.extent.union(slot.bounds);
    });
    pool.mesh.count = count;
    pool.mesh.visible = count > 0 && isTerrainPropVisibleAtLod(archetype, this.lod);
    if (count === 0) return;
    pool.mesh.boundingSphere = this.extent.getBoundingSphere(new Sphere());
    pool.mesh.boundingSphere.radius += radius;
  }

  private requirePool(archetype: TerrainPropArchetypeId): PropPool {
    const pool = this.pools.get(archetype);
    if (!pool) throw new Error(`Terrain prop pool is unavailable: ${archetype}`);
    return pool;
  }

  private requireCatalogMesh(archetype: TerrainPropArchetypeId, lod: TerrainPropLod): Mesh {
    const name = getTerrainPropMeshName(archetype, lod);
    const object = this.catalogScene.getObjectByName(name);
    if (!(object instanceof Mesh)) throw new Error(`Terrain prop catalog mesh is unavailable: ${name}`);
    return object;
  }

  private resolveMaximumCatalogMeshRadius(archetype: TerrainPropArchetypeId): number {
    return Math.max(
      resolveCatalogMeshRadius(this.requireCatalogMesh(archetype, "near")),
      resolveCatalogMeshRadius(this.requireCatalogMesh(archetype, "far")),
    );
  }
}

function groupByArchetype(
  instances: readonly TerrainPropInstance[],
): Map<TerrainPropArchetypeId, TerrainPropInstance[]> {
  const byArchetype = new Map<TerrainPropArchetypeId, TerrainPropInstance[]>();
  for (const instance of instances) {
    const entries = byArchetype.get(instance.archetype) ?? [];
    entries.push(instance);
    byArchetype.set(instance.archetype, entries);
  }
  return byArchetype;
}

function createEmptySlot(): PropPoolSlot {
  return { bounds: new Box3(), count: 0, pageKey: null, radius: 0 };
}

function findSlot(pool: PropPool, pageKey: string): number {
  return pool.slots.findIndex((slot) => slot.pageKey === pageKey);
}

function acquireSlot(pool: PropPool, archetype: TerrainPropArchetypeId, pageKey: string): number {
  const existing = findSlot(pool, pageKey);
  if (existing !== -1) return existing;
  const free = pool.slots.findIndex((slot) => slot.pageKey === null);
  if (free === -1) {
    throw new Error(
      `Terrain prop pool ${archetype} holds ${TERRAIN_PROP_POOL_PAGE_SLOTS} pages and has no slot left for page ${pageKey}`,
    );
  }
  return free;
}

function requireSlotCapacity(pool: PropPool, archetype: TerrainPropArchetypeId, pageKey: string, count: number): void {
  if (count <= pool.slotCapacity) return;
  throw new Error(
    `Terrain page ${pageKey} needs ${count} ${archetype} props; a page slot holds ${pool.slotCapacity} ` +
      `(${TERRAIN_PROP_POOL_PAGE_SLOTS} slots × ${pool.slotCapacity} = ${pool.mesh.instanceMatrix.count} pool instances)`,
  );
}

function countPoolInstances(pool: PropPool): number {
  return pool.slots.reduce((total, slot) => total + slot.count, 0);
}

function uploadSubRange(attribute: BufferAttribute, start: number, count: number, itemFloats: number): void {
  const rangeStart = start * itemFloats;
  const rangeCount = count * itemFloats;
  // Slot starts are fixed, so ranges queued for the same slot before a draw merge instead of piling up.
  const queued = attribute.updateRanges.find((range) => range.start === rangeStart);
  if (queued) queued.count = Math.max(queued.count, rangeCount);
  else attribute.addUpdateRange(rangeStart, rangeCount);
  attribute.needsUpdate = true;
}

function requireInstanceColor(mesh: InstancedMesh): InstancedBufferAttribute {
  if (!mesh.instanceColor) throw new Error(`Terrain prop pool ${mesh.name} has no instance colors to upload`);
  return mesh.instanceColor;
}

function createTerrainPropMaterial(
  animated: boolean,
  windStrength: UniformNode<"float", number> = uniform(0, "float"),
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 1 });
  const foliageWeight = attribute<"float">("_wind_weight", "float").clamp(0, 1);
  const ecology = attribute<"vec3">("terrainPropEcology", "vec3").clamp(0, 1);
  const verticality = normalGeometry.y.mul(normalGeometry.y).oneMinus().clamp(0, 1);
  const snowMask = ecology.z
    .mul(smoothstep(0.05, 0.85, normalGeometry.y))
    .mul(foliageWeight.mul(0.45).add(0.55))
    .clamp(0, 1);
  const mossMask = ecology.y.mul(verticality.mul(0.5).add(0.35)).mul(snowMask.mul(0.8).oneMinus()).clamp(0, 1);
  const mossyColor = mix(vertexColor().rgb, color("#627858"), mossMask.mul(0.48));
  material.colorNode = mix(mossyColor, color("#d8e0df"), snowMask.mul(0.78));
  if (!animated) return material;

  const heightMask = smoothstep(0.08, 1.1, positionGeometry.y);
  const phase = time.mul(0.72).add(positionLocal.x.mul(0.41)).add(positionLocal.z.mul(0.57));
  const mainSway = phase.sin().mul(0.018);
  const detailSway = phase.mul(1.73).add(positionGeometry.y.mul(2.4)).sin().mul(0.009);
  const displacement = heightMask.mul(foliageWeight).mul(ecology.x).mul(windStrength);
  material.positionNode = positionLocal.add(vec3(mainSway.mul(displacement), 0, detailSway.mul(displacement)));
  return material;
}

function resolveCatalogMeshRadius(source: Mesh): number {
  source.updateMatrix();
  if (!source.geometry.boundingSphere) source.geometry.computeBoundingSphere();
  const sphere = source.geometry.boundingSphere;
  if (!sphere) return 0;
  const transformedCenter = sphere.center.clone().applyMatrix4(source.matrix);
  return transformedCenter.length() + sphere.radius * source.matrix.getMaxScaleOnAxis();
}

function disablePropRaycast(raycaster: unknown, intersects: unknown[]): void {
  void raycaster;
  void intersects;
}
