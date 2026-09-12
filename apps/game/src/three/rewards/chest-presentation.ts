import { Color, Group, Material, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { color, texture, uniform, vec3 } from "three/tsl";

const CHEST_BODY_SCALE = 0.7;

/** Shared chest finish and orientation for settled instances and tile transitions. */
export class ChestPresentation {
  private readonly facing = new Group();
  private readonly cameraLocal = new Vector3();
  private readonly inversePlacement = new Matrix4();
  private readonly materials = new Map<Material, Material>();
  private readonly bodyBrightness = uniform(0.62);
  private readonly bodyGlow = uniform(0.025);

  constructor(
    private readonly object: Group,
    private readonly shellColor = "#bc9de8",
  ) {
    object.getObjectByName("ChestBody")?.scale.multiplyScalar(CHEST_BODY_SCALE);
    for (const name of ["ChestBody", "OrbitGems"]) {
      const part = object.getObjectByName(name);
      if (part) this.facing.add(part);
    }
    object.add(this.facing);
    object.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      const originals = Array.isArray(part.material) ? part.material : [part.material];
      const replacements = originals.map((original) => this.brightenSurface(original));
      part.material = Array.isArray(part.material) ? replacements : replacements[0];
    });
  }

  faceCamera(cameraPosition: Vector3, placement?: Matrix4): void {
    this.cameraLocal.copy(cameraPosition);
    if (placement) this.cameraLocal.applyMatrix4(this.inversePlacement.copy(placement).invert());
    this.object.updateWorldMatrix(true, false);
    this.object.worldToLocal(this.cameraLocal);
    this.facing.rotation.y = Math.atan2(this.cameraLocal.x, this.cameraLocal.z);
    this.facing.updateWorldMatrix(true, true);
  }

  setNightAmount(amount: number): void {
    const night = Math.max(0, Math.min(1, amount));
    this.bodyBrightness.value = 0.62 + 0.38 * night;
    this.bodyGlow.value = 0.025 + 0.425 * night;
  }

  dispose(): void {
    for (const material of this.materials.values()) material.dispose();
  }

  private brightenSurface(source: Material): Material {
    const cached = this.materials.get(source);
    if (cached) return cached;
    if (source instanceof MeshStandardMaterial && source.name.startsWith("Purple enamel")) {
      const material = new MeshStandardNodeMaterial({ roughness: 0.55, metalness: 0.12 });
      material.name = "Chest enamel preview";
      const grain = source.map
        ? texture(source.map)
            .rgb.dot(vec3(0.2126, 0.7152, 0.0722))
            .mul(0.65)
            .add(0.35)
        : 1;
      const enamel = color(this.shellColor).mul(grain);
      material.colorNode = enamel.mul(this.bodyBrightness);
      material.emissiveNode = enamel.mul(this.bodyGlow);
      this.materials.set(source, material);
      return material;
    }
    const material = source.clone();
    this.materials.set(source, material);
    if (!(material instanceof MeshStandardMaterial)) return material;
    if (/^(Rose gold|Polished bevels|Recessed bronze)/.test(material.name)) {
      material.color.set("#eeb14f");
      material.metalness = 0.4;
      material.roughness = 0.42;
      material.emissive.copy(material.color);
      material.emissiveIntensity = 0.3;
    } else if (material.name.startsWith("Ritual stone")) {
      material.color.lerp(new Color("#9782ae"), 0.4);
    }
    return material;
  }
}
