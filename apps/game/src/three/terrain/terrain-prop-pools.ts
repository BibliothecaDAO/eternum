import { mapAnimationTime as time } from "../effects/endgame/state";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";
import { queueInstanceUpdate } from "../utils/instance-update-ranges";
import { createInstancedMesh } from "../utils/create-instanced-mesh";
import {
  Box3,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Sphere,
  Vector3,
} from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  attribute,
  color,
  mix,
  normalGeometry,
  normalView,
  positionViewDirection,
  positionLocal,
  smoothstep,
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
  isTerrainGroundCover,
  isTerrainPropVisibleAtLod,
  TERRAIN_PROP_PAGE_SLOT_CAPACITY,
  type TerrainPropArchetypeId,
  type TerrainPropLod,
} from "./terrain-prop-catalog";
import type { TerrainPropInstance } from "./terrain-types";

/** Every pool holds bounded page ownership; live instances are packed into its drawn prefix. */
export const TERRAIN_PROP_POOL_PAGE_SLOTS = WORLD_CHUNK_CONFIG.visualPresentation.maxCompositePages;

const TERRAIN_PROP_ECOLOGY_ATTRIBUTE = "terrainPropEcology";
const ECOLOGY_FLOATS = 4;
const TERRAIN_PROP_GLOW_ATTRIBUTE = "terrainPropGlow";
const TERRAIN_PROP_PLANT_ATTRIBUTE = "terrainPropPlant";
const BAKED_PLANT_ATTRIBUTES = ["_wind_bend", "_wind_weight", "_glow"] as const;
const GLOW_FLOATS = 3;
const GLOW_INTENSITY = 1.2;
const WIND_SWAY_SHARE = 0.05;
const EMPTY_INSTANCES: readonly TerrainPropInstance[] = Object.freeze([]);

export interface TerrainPropPoolStats {
  groundCoverInstances: number;
  instances: number;
  triangles: number;
}

export interface TerrainPropPoolMetrics {
  /** Instance matrices uploaded by page writes, including relocated live instances. */
  instancesUploaded: number;
  pageWrites: number;
  /** Unused instances inside the submitted draw range; packed pools keep this at zero. */
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
  glow: InstancedBufferAttribute;
  geometry: BufferGeometry;
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

  /** Updates one page and shifts any following live ranges; unused capacity never enters a draw. */
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
    this.pools.forEach((pool, archetype) => {
      pool.mesh.castShadow = lod === "near" && getTerrainPropRole(archetype) === "canopy";
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
    this.pools.forEach((pool) => {
      pool.mesh.dispose();
      pool.geometry.dispose();
    });
    this.pools.clear();
    this.object3d.clear();
    this.rigidMaterial.dispose();
    this.windMaterial.dispose();
  }

  private createPool(archetype: TerrainPropArchetypeId): void {
    const slotCapacity = TERRAIN_PROP_PAGE_SLOT_CAPACITY[archetype];
    const capacity = slotCapacity * TERRAIN_PROP_POOL_PAGE_SLOTS;
    const ecology = new InstancedBufferAttribute(new Float32Array(capacity * ECOLOGY_FLOATS), ECOLOGY_FLOATS);
    const source = this.requireCatalogMesh(archetype);
    const glow = new InstancedBufferAttribute(new Float32Array(capacity * GLOW_FLOATS), GLOW_FLOATS);
    const geometry = createOwnedPropGeometry(source.geometry, ecology, glow);
    const material = getTerrainPropRole(archetype) === "rigid" ? this.rigidMaterial : this.windMaterial;
    const mesh = createInstancedMesh(geometry, material, capacity);
    mesh.name = `terrain-prop-pool:${archetype}`;
    mesh.count = 0;
    mesh.visible = false;
    // Canopy shadows anchor close forests; overview skips their extra geometry pass.
    mesh.castShadow = this.lod === "near" && getTerrainPropRole(archetype) === "canopy";
    mesh.receiveShadow = true;
    mesh.raycast = disablePropRaycast;
    this.pools.set(archetype, {
      catalogRadius: resolveCatalogMeshRadius(source),
      ecology,
      geometry,
      glow,
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
    const start = pool.slots.slice(0, slotIndex).reduce((sum, entry) => sum + entry.count, 0);
    this.metrics.instancesUploaded += moveFollowingInstances(pool, start, slot.count, instances.length);
    this.metrics.instancesUploaded += this.writeSlotInstances(pool, archetype, start, slot, instances);
    slot.count = instances.length;
    slot.pageKey = instances.length > 0 ? pageKey : null;
    this.refreshPoolExtent(pool, archetype);
  }

  /** Writes only live instances after the surrounding ranges have been packed. */
  private writeSlotInstances(
    pool: PropPool,
    archetype: TerrainPropArchetypeId,
    start: number,
    slot: PropPoolSlot,
    instances: readonly TerrainPropInstance[],
  ): number {
    const { mesh } = pool;
    const source = this.requireCatalogMesh(archetype);
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
      pool.ecology.setXYZW(
        index,
        instance.appearance.windAmplitude,
        instance.appearance.moss,
        instance.appearance.snow,
        resolveWindPhase(instance.worldX, instance.worldZ),
      );
      pool.glow.setXYZ(index, ...instance.appearance.glow);
      slot.radius = Math.max(slot.radius, pool.catalogRadius * instance.scale);
    });
    const written = instances.length;
    if (written === 0) return 0;
    queueInstanceUpdate(mesh.instanceMatrix, start, written);
    if (instances.length > 0) {
      queueInstanceUpdate(requireInstanceColor(mesh), start, instances.length);
      queueInstanceUpdate(pool.ecology, start, instances.length);
      queueInstanceUpdate(pool.glow, start, instances.length);
    }
    return written;
  }

  private refreshPoolExtent(pool: PropPool, archetype: TerrainPropArchetypeId): void {
    let count = 0;
    let radius = 0;
    this.extent.makeEmpty();
    pool.slots.forEach((slot) => {
      if (slot.count === 0) return;
      count += slot.count;
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

  private requireCatalogMesh(archetype: TerrainPropArchetypeId): Mesh {
    const object = this.catalogScene.getObjectByName(archetype);
    if (!(object instanceof Mesh)) throw new Error(`Terrain prop catalog mesh is unavailable: ${archetype}`);
    return object;
  }
}

function moveFollowingInstances(pool: PropPool, start: number, previousCount: number, nextCount: number): number {
  const source = start + previousCount;
  const destination = start + nextCount;
  const count = pool.mesh.count - source;
  if (source === destination || count === 0) return 0;
  for (const attribute of [pool.mesh.instanceMatrix, requireInstanceColor(pool.mesh), pool.ecology, pool.glow]) {
    const size = attribute.itemSize;
    attribute.array.copyWithin(destination * size, source * size, (source + count) * size);
    queueInstanceUpdate(attribute, destination, count);
  }
  return count;
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
      `(the pool holds ${pool.mesh.instanceMatrix.count} instances in ${TERRAIN_PROP_POOL_PAGE_SLOTS} slots)`,
  );
}

function countPoolInstances(pool: PropPool): number {
  return pool.slots.reduce((total, slot) => total + slot.count, 0);
}

function requireInstanceColor(mesh: InstancedMesh): InstancedBufferAttribute {
  if (!mesh.instanceColor) throw new Error(`Terrain prop pool ${mesh.name} has no instance colors to upload`);
  return mesh.instanceColor;
}

function createOwnedPropGeometry(
  source: BufferGeometry,
  ecology: InstancedBufferAttribute,
  glow: InstancedBufferAttribute,
): BufferGeometry {
  // World and local scenes share the catalog, but own their instance attributes and GPU buffer lifetimes.
  const geometry = source.clone();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const height = bounds.max.y - bounds.min.y;
  if (!(height > 0)) throw new Error(`Terrain prop geometry ${source.name} has no measurable height`);
  geometry.setAttribute(TERRAIN_PROP_PLANT_ATTRIBUTE, packBakedPlant(source, height));
  for (const name of BAKED_PLANT_ATTRIBUTES) geometry.deleteAttribute(name);
  geometry.setAttribute(TERRAIN_PROP_ECOLOGY_ATTRIBUTE, ecology);
  geometry.setAttribute(TERRAIN_PROP_GLOW_ATTRIBUTE, glow);
  return geometry;
}

function packBakedPlant(source: BufferGeometry, height: number): Float32BufferAttribute {
  const [bend, foliage, glow] = BAKED_PLANT_ATTRIBUTES.map((name) => {
    const baked = source.getAttribute(name);
    if (!baked) throw new Error(`Terrain prop geometry ${source.name} has no baked ${name}`);
    return baked;
  });
  const plant = new Float32Array(bend.count * 4);
  for (let index = 0; index < bend.count; index++) {
    plant.set([bend.getX(index), height, foliage.getX(index), glow.getX(index)], index * 4);
  }
  return new Float32BufferAttribute(plant, 4);
}

function resolveWindPhase(worldX: number, worldZ: number): number {
  const wave = Math.sin(worldX * 12.9898 + worldZ * 78.233) * 43758.5453;
  return wave - Math.floor(wave);
}

function createTerrainPropMaterial(
  animated: boolean,
  windStrength: UniformNode<"float", number> = uniform(0, "float"),
): MeshStandardNodeMaterial {
  const material = new FrostedStandardNodeMaterial({ metalness: 0, roughness: 1 });
  const plant = attribute<"vec4">(TERRAIN_PROP_PLANT_ATTRIBUTE, "vec4");
  const foliageWeight = plant.z.clamp(0, 1);
  const ecology = attribute<"vec4">("terrainPropEcology", "vec4").clamp(0, 1);
  const verticality = normalGeometry.y.mul(normalGeometry.y).oneMinus().clamp(0, 1);
  const snowMask = ecology.z
    .mul(smoothstep(0.05, 0.85, normalGeometry.y))
    .mul(foliageWeight.mul(0.45).add(0.55))
    .clamp(0, 1);
  const mossMask = ecology.y.mul(verticality.mul(0.5).add(0.35)).mul(snowMask.mul(0.8).oneMinus()).clamp(0, 1);
  const mossyColor = mix(vertexColor().rgb, color("#627858"), mossMask.mul(0.48));
  const canopyLight = foliageWeight.mul(smoothstep(0.1, 0.85, normalGeometry.y)).mul(0.18);
  const foliageColor = mix(mossyColor, color("#afc675"), canopyLight);
  // A crown catches the light along its edge, the way a soft ball of leaves does.
  const rim = normalView.dot(positionViewDirection).clamp(0, 1).oneMinus().pow(3).mul(foliageWeight).mul(0.4);
  const rimmedColor = mix(foliageColor, color("#d6ee8c"), rim);
  material.colorNode = mix(rimmedColor, color("#d8e0df"), snowMask.mul(0.78));
  material.emissiveNode = attribute<"vec3">(TERRAIN_PROP_GLOW_ATTRIBUTE, "vec3")
    .mul(plant.w.clamp(0, 1))
    .mul(GLOW_INTENSITY);
  if (!animated) return material;

  const amplitude = plant.y.mul(WIND_SWAY_SHARE);
  const phase = time
    .mul(0.72)
    .add(positionLocal.x.mul(0.41))
    .add(positionLocal.z.mul(0.57))
    .add(ecology.w.mul(Math.PI * 2));
  const mainSway = phase.sin().mul(amplitude);
  const detailSway = phase.mul(1.73).add(plant.x.mul(2.4)).sin().mul(amplitude).mul(0.35);
  const displacement = plant.x.mul(ecology.x).mul(windStrength);
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
