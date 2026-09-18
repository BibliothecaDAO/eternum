import { AdditiveBlending, BufferGeometry, Group, InstancedMesh, MeshStandardMaterial, Sphere } from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { color, normalLocal, normalView, positionLocal, positionViewDirection } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { createInstancedMeshWithSharedMatrices } from "../utils/create-instanced-mesh";
import { MaterialPool } from "../utils/material-pool";

export interface GlowOptions {
  name?: string;
  width?: number;
  intensity?: number;
  opacity?: number;
  brightness?: number;
}

/** Authored materials that carry local light diffusion, keyed by the material name the exporter writes. */
export const LOCAL_GLOW_MATERIALS: Readonly<Record<string, GlowOptions>> = {
  "Satoshi gold / pixel core": {
    name: "Bitcoin pixel light",
    width: 0.006,
    intensity: 0.78,
    opacity: 0.1,
    brightness: 0.7,
  },
};

/** Local light diffusion for the game's renderer, which deliberately runs without screen-space bloom. */
export class LocalEmissiveGlow {
  private readonly group = new Group();
  private readonly halos: Array<{ source: InstancedMesh; mesh: InstancedMesh }> = [];
  private readonly geometries = new Map<BufferGeometry, BufferGeometry>();
  private readonly materials = new Map<MeshStandardMaterial, MeshBasicNodeMaterial>();

  constructor(
    meshes: InstancedMesh[],
    group: Group,
    private readonly options: GlowOptions = {},
  ) {
    this.group.name = options.name ?? "Spire vein light";
    // Light behind the portal must be composed before its translucent core, while opaque veins still occlude normally.
    this.group.renderOrder = Number.MIN_SAFE_INTEGER;
    group.add(this.group);
    for (const source of meshes) {
      const authored = source.material;
      if (!(authored instanceof MeshStandardMaterial) || authored.emissive.getHex() === 0) continue;
      this.preserveEmissiveHue(source, authored);
      const halo = createInstancedMeshWithSharedMatrices(
        this.haloGeometry(source.geometry),
        this.haloMaterial(authored),
        source,
      );
      halo.name = `${source.name} / soft vein light`;
      halo.raycast = () => {};
      halo.renderOrder = 11;
      halo.castShadow = false;
      halo.receiveShadow = false;
      this.group.add(halo);
      this.halos.push({ source, mesh: halo });
    }
  }

  updateBoundsAndCount(): void {
    for (const { source, mesh } of this.halos) {
      mesh.count = source.count;
      mesh.frustumCulled = source.frustumCulled;
      if (source.boundingSphere) {
        mesh.boundingSphere ??= new Sphere();
        mesh.boundingSphere.copy(source.boundingSphere);
        mesh.boundingSphere.radius += this.options.width ?? 0.012;
      }
    }
  }

  dispose(): void {
    // Followers borrow immutable source buffers; releasing their shared attributes would invalidate the source draw.
    for (const { mesh } of this.halos) mesh.removeFromParent();
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.group.removeFromParent();
    this.halos.length = 0;
    this.geometries.clear();
    this.materials.clear();
  }

  private preserveEmissiveHue(mesh: InstancedMesh, authored: MeshStandardMaterial): void {
    const display = authored.clone();
    // Keep the authored color saturated under the shared ACES scene lighting.
    display.toneMapped = false;
    display.emissiveIntensity = this.options.intensity ?? 1.5;
    const pool = MaterialPool.getInstance();
    mesh.material = pool.getStandardMaterial(display);
    pool.releaseMaterial(authored);
  }

  private haloGeometry(source: BufferGeometry): BufferGeometry {
    let geometry = this.geometries.get(source);
    if (geometry) return geometry;
    const positions = source.clone();
    for (const attribute of Object.keys(positions.attributes))
      if (attribute !== "position") positions.deleteAttribute(attribute);
    // Smooth the light shell while preserving the authored mesh and its faceted normals.
    geometry = mergeVertices(positions);
    positions.dispose();
    geometry.computeVertexNormals();
    this.geometries.set(source, geometry);
    return geometry;
  }

  private haloMaterial(source: MeshStandardMaterial): MeshBasicNodeMaterial {
    let material = this.materials.get(source);
    if (material) return material;
    material = new MeshBasicNodeMaterial({
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    material.name = `${source.name} / diffuse light`;
    material.colorNode = color(source.emissive).mul(this.options.brightness ?? 1.2);
    material.positionNode = positionLocal.add(normalLocal.mul(this.options.width ?? 0.012));
    material.opacityNode = normalView
      .dot(positionViewDirection)
      .abs()
      .pow(1.5)
      .mul(this.options.opacity ?? 0.65);
    this.materials.set(source, material);
    return material;
  }
}
