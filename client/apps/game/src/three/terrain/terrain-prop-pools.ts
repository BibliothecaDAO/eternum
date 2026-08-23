import { Box3, Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh, Quaternion, Sphere, Vector3 } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";

import { loadTerrainPropCatalog } from "./terrain-prop-asset-cache";
import {
  TERRAIN_PROP_ARCHETYPE_IDS,
  getTerrainPropMeshName,
  type TerrainPropArchetypeId,
  type TerrainPropLod,
} from "./terrain-prop-catalog";
import type { TerrainPropInstance } from "./terrain-types";

export const TERRAIN_PROP_POOL_CAPACITY = 8192;

export interface TerrainPropPoolStats {
  instances: number;
  triangles: number;
}

export class TerrainPropPools {
  readonly object3d = new Group();
  private readonly meshes = new Map<TerrainPropArchetypeId, InstancedMesh>();
  private readonly material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 1, vertexColors: true });
  private readonly matrix = new Matrix4();
  private readonly tint = new Color();
  private readonly position = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly scale = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private lod: TerrainPropLod = "near";

  private constructor(private readonly catalogScene: Group) {
    this.object3d.name = "terrain-prop-pools";
    this.material.name = "terrain-props";
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
        this.tint.setRGB(...instance.tint);
        mesh.setColorAt(index, this.tint);
        maximumInstanceRadius = Math.max(maximumInstanceRadius, catalogRadius * instance.scale);
      });
      mesh.count = entries.length;
      mesh.instanceMatrix.needsUpdate = entries.length > 0;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = entries.length > 0;
      mesh.visible = entries.length > 0;
      if (entries.length > 0) {
        mesh.boundingSphere = bounds.getBoundingSphere(new Sphere());
        mesh.boundingSphere.radius += maximumInstanceRadius;
      }
    }
  }

  setLod(lod: TerrainPropLod): void {
    if (lod === this.lod) return;
    this.lod = lod;
    for (const archetype of TERRAIN_PROP_ARCHETYPE_IDS) {
      this.requirePool(archetype).geometry = this.requireCatalogMesh(archetype, lod).geometry;
    }
  }

  getStats(): TerrainPropPoolStats {
    let instances = 0;
    let triangles = 0;
    this.meshes.forEach((mesh) => {
      const sourceTriangles = (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3;
      instances += mesh.count;
      triangles += sourceTriangles * mesh.count;
    });
    return { instances, triangles };
  }

  dispose(): void {
    this.meshes.forEach((mesh) => mesh.dispose());
    this.meshes.clear();
    this.object3d.clear();
    this.material.dispose();
  }

  private createPool(archetype: TerrainPropArchetypeId): void {
    const source = this.requireCatalogMesh(archetype, this.lod);
    const mesh = new InstancedMesh(source.geometry, this.material, TERRAIN_PROP_POOL_CAPACITY);
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
