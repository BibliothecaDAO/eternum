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

export const TERRAIN_PROP_POOL_CAPACITY = 8192;
const TERRAIN_PROP_ECOLOGY_ATTRIBUTE = "terrainPropEcology";

export interface TerrainPropPoolStats {
  groundCoverInstances: number;
  instances: number;
  triangles: number;
}

export class TerrainPropPools {
  readonly object3d = new Group();
  private readonly ecologyAttributes = new Map<TerrainPropArchetypeId, InstancedBufferAttribute>();
  private readonly meshes = new Map<TerrainPropArchetypeId, InstancedMesh>();
  private readonly rigidMaterial = createTerrainPropMaterial(false);
  private readonly windStrength = uniform(1, "float");
  private readonly windMaterial = createTerrainPropMaterial(true, this.windStrength);
  private readonly matrix = new Matrix4();
  private readonly tint = new Color();
  private readonly position = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly scale = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
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

  update(instances: readonly TerrainPropInstance[]): void {
    const instancesByArchetype = new Map<TerrainPropArchetypeId, TerrainPropInstance[]>();
    for (const instance of instances) {
      const entries = instancesByArchetype.get(instance.archetype) ?? [];
      entries.push(instance);
      instancesByArchetype.set(instance.archetype, entries);
    }

    for (const archetype of TERRAIN_PROP_ARCHETYPE_IDS) {
      const mesh = this.requirePool(archetype);
      const ecologyAttribute = this.requireEcologyAttribute(archetype);
      const entries = instancesByArchetype.get(archetype) ?? [];
      const source = this.requireCatalogMesh(archetype, this.lod);
      source.updateMatrix();
      if (entries.length > TERRAIN_PROP_POOL_CAPACITY) {
        throw new Error(`${archetype} terrain prop pool exceeded ${TERRAIN_PROP_POOL_CAPACITY} instances`);
      }
      const bounds = new Box3();
      const catalogRadius = this.resolveMaximumCatalogMeshRadius(archetype);
      let maximumInstanceRadius = 0;
      entries.forEach((instance, index) => {
        this.position.set(instance.worldX, instance.worldY, instance.worldZ);
        bounds.expandByPoint(this.position);
        this.quaternion.setFromAxisAngle(this.up, instance.yaw);
        this.scale.setScalar(instance.scale);
        this.matrix.compose(this.position, this.quaternion, this.scale);
        this.matrix.multiply(source.matrix);
        mesh.setMatrixAt(index, this.matrix);
        this.tint.setRGB(...instance.appearance.tint);
        mesh.setColorAt(index, this.tint);
        ecologyAttribute.setXYZ(
          index,
          instance.appearance.windAmplitude,
          instance.appearance.moss,
          instance.appearance.snow,
        );
        maximumInstanceRadius = Math.max(maximumInstanceRadius, catalogRadius * instance.scale);
      });
      mesh.count = entries.length;
      ecologyAttribute.needsUpdate = entries.length > 0;
      mesh.instanceMatrix.needsUpdate = entries.length > 0;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = entries.length > 0;
      mesh.visible = entries.length > 0 && isTerrainPropVisibleAtLod(archetype, this.lod);
      if (entries.length > 0) {
        mesh.boundingSphere = bounds.getBoundingSphere(new Sphere());
        mesh.boundingSphere.radius += maximumInstanceRadius;
      }
    }
  }

  setLod(lod: TerrainPropLod): void {
    if (lod === this.lod) return;
    this.lod = lod;
    this.windStrength.value = lod === "near" ? 1 : 0.35;
    for (const archetype of TERRAIN_PROP_ARCHETYPE_IDS) {
      const mesh = this.requirePool(archetype);
      mesh.geometry = this.requireCatalogMesh(archetype, lod).geometry;
      mesh.visible = mesh.count > 0 && isTerrainPropVisibleAtLod(archetype, lod);
    }
  }

  setWindStrength(strength: number): void {
    this.windStrength.value = Math.min(1, Math.max(0, strength));
  }

  getStats(): TerrainPropPoolStats {
    let instances = 0;
    let groundCoverInstances = 0;
    let triangles = 0;
    this.meshes.forEach((mesh, archetype) => {
      if (!mesh.visible) return;
      const sourceTriangles = (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3;
      instances += mesh.count;
      if (isTerrainGroundCover(archetype)) groundCoverInstances += mesh.count;
      triangles += sourceTriangles * mesh.count;
    });
    return { groundCoverInstances, instances, triangles };
  }

  dispose(): void {
    this.ecologyAttributes.forEach((attribute, archetype) => {
      for (const lod of ["near", "far"] as const) {
        const geometry = this.requireCatalogMesh(archetype, lod).geometry;
        if (geometry.getAttribute(TERRAIN_PROP_ECOLOGY_ATTRIBUTE) === attribute) {
          geometry.deleteAttribute(TERRAIN_PROP_ECOLOGY_ATTRIBUTE);
        }
      }
    });
    this.ecologyAttributes.clear();
    this.meshes.forEach((mesh) => mesh.dispose());
    this.meshes.clear();
    this.object3d.clear();
    this.rigidMaterial.dispose();
    this.windMaterial.dispose();
  }

  private createPool(archetype: TerrainPropArchetypeId): void {
    const ecologyAttribute = new InstancedBufferAttribute(new Float32Array(TERRAIN_PROP_POOL_CAPACITY * 3), 3);
    ecologyAttribute.setUsage(DynamicDrawUsage);
    for (const lod of ["near", "far"] as const) {
      this.requireCatalogMesh(archetype, lod).geometry.setAttribute(TERRAIN_PROP_ECOLOGY_ATTRIBUTE, ecologyAttribute);
    }
    this.ecologyAttributes.set(archetype, ecologyAttribute);
    const source = this.requireCatalogMesh(archetype, this.lod);
    const material = getTerrainPropRole(archetype) === "rigid" ? this.rigidMaterial : this.windMaterial;
    const mesh = new InstancedMesh(source.geometry, material, TERRAIN_PROP_POOL_CAPACITY);
    mesh.name = `terrain-prop-pool:${archetype}`;
    mesh.count = 0;
    // A full-screen forest otherwise submits every prop geometry again to the
    // shadow pass. The ground and structures retain authored shadows.
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.raycast = disablePropRaycast;
    this.meshes.set(archetype, mesh);
    this.object3d.add(mesh);
  }

  private requirePool(archetype: TerrainPropArchetypeId): InstancedMesh {
    const mesh = this.meshes.get(archetype);
    if (!mesh) throw new Error(`Terrain prop pool is unavailable: ${archetype}`);
    return mesh;
  }

  private requireEcologyAttribute(archetype: TerrainPropArchetypeId): InstancedBufferAttribute {
    const attribute = this.ecologyAttributes.get(archetype);
    if (!attribute) throw new Error(`Terrain prop ecology is unavailable: ${archetype}`);
    return attribute;
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
