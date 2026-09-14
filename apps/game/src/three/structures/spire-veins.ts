import { AdditiveBlending, BufferGeometry, Group, InstancedMesh, MeshStandardMaterial, Sphere } from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { color, normalLocal, normalView, positionLocal, positionViewDirection } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { createInstancedMeshWithSharedMatrices } from "../utils/create-instanced-mesh";
import { MaterialPool } from "../utils/material-pool";

const HALO_WIDTH = 0.012;

/** Local light diffusion for the game's renderer, which deliberately runs without screen-space bloom. */
export class SpireVeins {
  private readonly group = new Group();
  private readonly halos: Array<{ source: InstancedMesh; mesh: InstancedMesh }> = [];
  private readonly geometries = new Map<BufferGeometry, BufferGeometry>();
  private readonly materials = new Map<MeshStandardMaterial, MeshBasicNodeMaterial>();

  constructor(meshes: InstancedMesh[], group: Group) {
    this.group.name = "Spire vein light";
    // Light behind the portal must be composed before its translucent core, while opaque veins still occlude normally.
    this.group.renderOrder = Number.MIN_SAFE_INTEGER;
    group.add(this.group);
    for (const source of meshes) {
      const authored = source.material;
      if (!(authored instanceof MeshStandardMaterial) || authored.emissive.getHex() === 0) continue;
      this.preserveVeinHue(source, authored);
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
      if (source.boundingSphere) {
        mesh.boundingSphere ??= new Sphere();
        mesh.boundingSphere.copy(source.boundingSphere);
        mesh.boundingSphere.radius += HALO_WIDTH;
      }
    }
  }

  dispose(): void {
    // A halo owns no GPU buffer: its matrices belong to the source, and its geometry and material are released below.
    for (const { mesh } of this.halos) mesh.removeFromParent();
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.group.removeFromParent();
    this.halos.length = 0;
    this.geometries.clear();
    this.materials.clear();
  }

  private preserveVeinHue(mesh: InstancedMesh, authored: MeshStandardMaterial): void {
    const display = authored.clone();
    // ACES turns the authored strength-10, subpixel veins white. Keep their RGB/PBR data and a saturated display core.
    display.toneMapped = false;
    display.emissiveIntensity = 1.5;
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
    // Smooth only the light shell; the authored five-sided tubes and their faceted normals remain untouched.
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
    material.colorNode = color(source.emissive).mul(1.2);
    material.positionNode = positionLocal.add(normalLocal.mul(HALO_WIDTH));
    material.opacityNode = normalView.dot(positionViewDirection).abs().pow(1.5).mul(0.65);
    this.materials.set(source, material);
    return material;
  }
}
