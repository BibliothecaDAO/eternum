import { Color, Group, MathUtils, Mesh, MeshStandardMaterial } from "three";

interface NightUniformHandle {
  value: number;
}

export class RiftPresentation {
  private readonly materials = new Map<MeshStandardMaterial, MeshStandardMaterial>();
  private readonly nightUniforms = new Set<NightUniformHandle>();
  private readonly nightEmission = new Color("#703bc4");

  constructor(object: Group) {
    object.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      const originals = Array.isArray(part.material) ? part.material : [part.material];
      const replacements = originals.map((source) => {
        const nightUniform = (source.userData as { nightAmount?: NightUniformHandle } | undefined)?.nightAmount;
        if (nightUniform && typeof nightUniform.value === "number") {
          this.nightUniforms.add(nightUniform);
          return source;
        }
        if (!(source instanceof MeshStandardMaterial) || !/^(Living liquid|Eruption liquid)/.test(source.name))
          return source;
        if (!this.materials.has(source)) this.materials.set(source, source.clone());
        return this.materials.get(source)!;
      });
      part.material = Array.isArray(part.material) ? replacements : replacements[0];
    });
  }

  setNightAmount(amount: number): void {
    const night = MathUtils.clamp(amount, 0, 1);
    for (const uniform of this.nightUniforms) uniform.value = night;
    for (const [source, material] of this.materials) {
      material.emissive.copy(source.emissive).lerp(this.nightEmission, night * 0.65);
      material.roughness = MathUtils.lerp(source.roughness, Math.min(source.roughness, 0.2), night);
    }
  }

  dispose(): void {
    this.nightUniforms.clear();
    for (const material of this.materials.values()) material.dispose();
  }
}
