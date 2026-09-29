import {
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Vector3,
  Color,
  type ColorRepresentation,
  type Material,
} from "three";
import {
  buildRuneFlames,
  createArcaneStoneMaterial,
  createChestRadiance,
  createRuneFlameMaterials,
} from "./reward-summoning-effects";

const smooth = (start: number, end: number, time: number) => MathUtils.smoothstep(time, start, end);
const SUMMONING_DURATION = 1;

/** The entire reward tile erupts, summons its chest, then returns to the biome after opening. */
export class RewardSummoning {
  private elapsed = 0;
  private animationTime = 0;
  private openedAt: number | null = null;
  private readonly ground: Vector3;
  private readonly body: Object3D;
  private readonly lid: Object3D;
  private readonly contents: Object3D[] = [];
  private readonly rings: Object3D[] = [];
  private readonly hinge = new Vector3(0, 0.55, -0.35);
  private readonly flameMaterials = createRuneFlameMaterials();
  private readonly radiance = createChestRadiance();
  private readonly shadows: Mesh[] = [];
  private readonly interior = new Group();
  private readonly light = new PointLight(0xd99aff, 0, 3, 2);

  private readonly interiorMaterials: MeshStandardMaterial[] = [];
  private readonly stoneMaterials: Material[] = [];
  private readonly replacedMaterials = new Map<Mesh, Material | Material[]>();
  private readonly debris = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    new MeshStandardMaterial({ color: 0x9f8359, roughness: 1 }),
    24,
  );
  private readonly fragment = new Object3D();
  /** Light leaking from a shut lid while a Frontier chest's result is pending (0–1). */
  private seam = 0;
  /** How far the beams may rise: full only at rare and above. */
  private beamLimit = 1;
  /** The authored interior glow colours, so a tinted chest can return to the plain one. */
  private readonly interiorEmissive = new Map<MeshStandardMaterial, Color>();
  /** This chest's own crystals, with their authored glow, so a rarity can light them. */
  private readonly gems = new Map<MeshStandardMaterial, { emissive: Color; intensity: number }>();
  private readonly rarityGlow = new Color();
  private readonly lightColour = new Color(0xd99aff);

  constructor(
    private readonly object: Group,
    private readonly lightingRoot: Object3D,
    illuminateScene = true,
  ) {
    this.ground = object.position.clone();
    const body = this.findPivot("ChestBody");
    const lid = this.findPivot("ChestLid");
    if (!body || !lid) throw new Error("Arcane chest is missing its body or lid pivot");
    this.body = body;
    this.lid = lid;
    this.contents.push(body);
    const orbit = this.findPivot("OrbitGems");
    if (orbit) this.contents.push(orbit);
    this.createTurningRings();
    this.illuminateRitualStone();
    this.configureInteriorLight(illuminateScene);
    this.ownCrystals();
    this.debris.frustumCulled = false;
    object.add(this.debris);
    this.sample();
  }

  private createTurningRings(): void {
    for (let index = 0; index < 2; index++) {
      const ring = this.findPivot(`ArcaneSealRing${index}`);
      if (!ring) throw new Error("Arcane chest is missing its rotating rings; rebuild chest-c2.glb");
      this.rings.push(ring);
      const shadow = new Mesh(buildRuneFlames(this.bindRuneInlays(ring)), this.flameMaterials.flame);
      shadow.frustumCulled = false;
      this.shadows.push(shadow);
      ring.add(shadow);
    }
  }

  open(): void {
    if (this.openedAt !== null) return;
    this.openedAt = Math.max(SUMMONING_DURATION, this.elapsed);
  }

  restart(): void {
    this.openedAt = null;
    this.elapsed = 0;
    this.animationTime = 0;
    this.sample();
  }

  seek(seconds: number): void {
    this.openedAt = null;
    this.elapsed = seconds;
    this.animationTime = seconds;
    this.sample();
  }

  /**
   * A Frontier chest's moment: light leaks from the seams of the shut lid in `tint`; `runes` (0–1) turns the rune rings
   * and crystals, the chest's largest lit surfaces, from their authored violet and cyan to the tint; and the beams it
   * opens with burn to `beam.limit`, reaching `beam.reach` times their authored height at `beam.boost` brightness.
   */
  setGlow({
    seam,
    tint,
    runes = 0,
    beam = { limit: 1, reach: 1, boost: 1 },
  }: {
    seam: number;
    tint: ColorRepresentation;
    runes?: number;
    beam?: { limit: number; reach: number; boost: number };
  }): void {
    this.seam = MathUtils.clamp(seam, 0, 1);
    this.beamLimit = MathUtils.clamp(beam.limit, 0, 1);
    this.radiance.tint.value.set(tint);
    this.radiance.tinted.value = MathUtils.clamp(runes, 0, 1);
    this.radiance.reach.value = beam.reach;
    this.radiance.boost.value = beam.boost;
    this.light.color.set(tint);
    // The inside shows through the crack: its glow takes the tint too.
    for (const material of this.interiorMaterials) material.emissive.set(tint);
    const amount = MathUtils.clamp(runes, 0, 1);
    this.flameMaterials.rarityTint.value.set(tint);
    this.flameMaterials.rarityAmount.value = amount;
    this.rarityGlow.set(tint);
    for (const [material, authored] of this.gems) {
      material.emissive.copy(authored.emissive).lerp(this.rarityGlow, amount);
      material.emissiveIntensity = authored.intensity + amount * 2.5;
    }
    this.sample();
  }

  /** Back to the plain chest: no seam, full beams and the authored colours. */
  clearGlow(): void {
    this.seam = 0;
    this.beamLimit = 1;
    this.radiance.tinted.value = 0;
    this.radiance.reach.value = 1;
    this.radiance.boost.value = 1;
    this.light.color.copy(this.lightColour);
    for (const [material, colour] of this.interiorEmissive) material.emissive.copy(colour);
    this.flameMaterials.rarityAmount.value = 0;
    for (const [material, authored] of this.gems) {
      material.emissive.copy(authored.emissive);
      material.emissiveIntensity = authored.intensity;
    }
    this.sample();
  }

  /** Gives this chest its own crystal materials: the model's are shared by every chest on the map. */
  private ownCrystals(): void {
    this.object.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      const materials: Material[] = Array.isArray(part.material) ? part.material : [part.material];
      if (!materials.some((material) => /^(Cyan crystal|Crystal highlight)/.test(material.name))) return;
      if (!this.replacedMaterials.has(part)) this.replacedMaterials.set(part, part.material);
      const replacements = materials.map((material) => {
        if (!(material instanceof MeshStandardMaterial) || !/^(Cyan crystal|Crystal highlight)/.test(material.name))
          return material;
        const gem = material.clone();
        this.gems.set(gem, { emissive: gem.emissive.clone(), intensity: gem.emissiveIntensity });
        return gem;
      });
      part.material = Array.isArray(part.material) ? replacements : replacements[0];
    });
  }

  get revealProgress(): number {
    return smooth(0.575, 0.85, this.elapsed);
  }

  get isSummoned(): boolean {
    return this.elapsed >= SUMMONING_DURATION;
  }

  get openingElapsed(): number {
    return this.openedAt === null ? 0 : Math.max(0, this.elapsed - this.openedAt);
  }

  get isAbsorbed(): boolean {
    return this.openedAt !== null && this.elapsed - this.openedAt >= 2.7;
  }

  update(delta: number, animationTime = this.elapsed + delta): void {
    this.elapsed += delta;
    this.animationTime = animationTime;
    this.sample();
  }

  dispose(): void {
    for (const [mesh, material] of this.replacedMaterials) mesh.material = material;
    for (const material of this.interiorMaterials) material.dispose();
    for (const material of this.gems.keys()) material.dispose();
    for (const material of this.stoneMaterials) material.dispose();
    this.flameMaterials.flame.dispose();
    this.flameMaterials.glyph.dispose();
    for (const shadow of this.shadows) {
      shadow.geometry.dispose();
      shadow.removeFromParent();
    }
    this.radiance.material.dispose();
    this.radiance.geometry.dispose();
    this.light.dispose();
    this.light.removeFromParent();
    this.debris.geometry.dispose();
    this.debris.material.dispose();
    this.debris.removeFromParent();
    this.interior.removeFromParent();
    this.object.position.copy(this.ground);
    this.object.visible = true;
  }

  private findPivot(name: string): Object3D | undefined {
    const pivot = this.object.getObjectByName(name);
    return pivot instanceof Mesh ? undefined : pivot;
  }

  private bindRuneInlays(ring: Object3D): Vector3[] {
    const sources: Vector3[] = [];
    ring.updateWorldMatrix(true, true);
    ring.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      const materials: Material[] = Array.isArray(part.material) ? part.material : [part.material];
      if (!materials.some((material) => material.name.startsWith("Ritual violet"))) return;
      this.replacedMaterials.set(part, part.material);
      const replacements = materials.map((material) =>
        material.name.startsWith("Ritual violet") ? this.flameMaterials.glyph : material,
      );
      part.material = Array.isArray(part.material) ? replacements : replacements[0];
      const positions = part.geometry.getAttribute("position");
      // GLTFLoader separates material primitives; sample the luminous inlay itself.
      for (let index = 0; index < positions.count; index += Math.max(1, Math.floor(positions.count / 100))) {
        const source = new Vector3().fromBufferAttribute(positions, index);
        sources.push(ring.worldToLocal(part.localToWorld(source)));
      }
    });
    if (!sources.length) throw new Error("Arcane ring has no luminous rune inlays");
    return sources;
  }

  private configureInteriorLight(illuminateScene: boolean): void {
    this.light.position.set(0, 0.42, 0);
    // Keep the light list stable while the tile and its beams change visibility.
    if (illuminateScene) this.lightingRoot.add(this.light);
    for (const angle of [0, Math.PI / 2, Math.PI / 4]) {
      const beam = new Mesh(this.radiance.geometry, this.radiance.material);
      beam.rotation.y = angle;
      this.interior.add(beam);
    }
    this.body.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      const materials: Material[] = Array.isArray(part.material) ? part.material : [part.material];
      if (!materials.some((material) => material.name.startsWith("Essence violet"))) return;
      this.replacedMaterials.set(part, part.material);
      const replacements = materials.map((material) => {
        if (!(material instanceof MeshStandardMaterial) || !material.name.startsWith("Essence violet")) return material;
        const interior = material.clone();
        this.interiorMaterials.push(interior);
        this.interiorEmissive.set(interior, interior.emissive.clone());
        return interior;
      });
      part.material = Array.isArray(part.material) ? replacements : replacements[0];
    });
    this.body.add(this.interior);
  }

  private illuminateRitualStone(): void {
    this.object.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      const materials: Material[] = Array.isArray(part.material) ? part.material : [part.material];
      if (!materials.some((material) => /^(Ritual stone|Ritual violet|Carved rune face)/.test(material.name))) return;
      if (!this.replacedMaterials.has(part)) this.replacedMaterials.set(part, part.material);
      const replacements = materials.map((material) => {
        if (!(material instanceof MeshStandardMaterial)) return material;
        if (/^(Ritual violet|Carved rune face)/.test(material.name)) return this.flameMaterials.glyph;
        if (!material.name.startsWith("Ritual stone")) return material;
        const stone = createArcaneStoneMaterial(material, this.flameMaterials);
        this.stoneMaterials.push(stone);
        return stone;
      });
      part.material = Array.isArray(part.material) ? replacements : replacements[0];
    });
  }

  private sample(): void {
    const departure = this.openedAt === null ? 0 : this.elapsed - this.openedAt;
    this.sampleGround(departure);
    this.sampleChest(departure);
    this.sampleFlames(departure);
    this.sampleDebris(departure);
  }

  private sampleGround(departure: number): void {
    const rise = smooth(0, SUMMONING_DURATION * 0.25, this.elapsed);
    const sink = smooth(1.85, 2.65, departure);
    const quake = Math.sin(this.elapsed * 65) * (1 - rise) * 0.018;
    this.object.visible = departure < 2.7;
    this.object.position.copy(this.ground);
    this.object.position.y += -0.38 * (1 - rise) - sink * 1.45;
    this.object.position.x += quake;
    this.object.position.z += quake * 0.6;
    for (const [index, ring] of this.rings.entries()) {
      ring.rotation.y = this.animationTime * (index === 0 ? 0.24 : -0.32);
    }
  }

  private sampleChest(departure: number): void {
    const opening = smooth(0, 0.4, departure) * (1 - smooth(1.15, 1.65, departure));
    // A pending chest's lid sits a crack open, and its glow is the larger of that leak and the opening.
    const glow = Math.max(opening, this.seam * (this.openedAt === null ? 1 : 0));
    for (const content of this.contents) content.visible = this.elapsed >= SUMMONING_DURATION * 0.5;
    this.lid.rotation.set(-(opening * 1.65 + (this.openedAt === null ? this.seam * 0.15 : 0)), 0, 0);
    this.lid.position.copy(this.hinge).applyQuaternion(this.lid.quaternion).negate().add(this.hinge);
    const settle = smooth(1.4, 1.85, departure);
    this.body.position.y = MathUtils.lerp(this.body.position.y, 0.073, settle);
    this.body.rotation.x *= 1 - settle;
    this.body.rotation.y *= 1 - settle;
    this.body.rotation.z *= 1 - settle;
    this.interior.visible = glow > 0;
    this.light.intensity = glow * 4.5;
    this.body.updateWorldMatrix(true, false);
    this.light.position.set(0, 0.42, 0);
    this.body.localToWorld(this.light.position);
    this.lightingRoot.worldToLocal(this.light.position);
    this.radiance.strength.value = Math.min(glow, this.beamLimit);
    for (const material of this.interiorMaterials) material.emissiveIntensity = 0.8 + glow * 5;
  }

  private sampleFlames(departure: number): void {
    const ignite = smooth(SUMMONING_DURATION * 0.19, SUMMONING_DURATION * 0.425, this.elapsed);
    const evaporate = smooth(SUMMONING_DURATION * 0.575, SUMMONING_DURATION, this.elapsed);
    const absorb = smooth(1.65, 1.95, departure) * (1 - smooth(2.2, 2.65, departure));
    const density = Math.max(ignite * (1 - evaporate), absorb * 0.9);
    for (const shadow of this.shadows) {
      shadow.visible = density > 0.001;
      shadow.scale.y = 0.2 + ignite * 0.8;
    }
    this.flameMaterials.clock.value = this.animationTime;
    this.flameMaterials.density.value = density;
    this.flameMaterials.rise.value = departure > 0 ? -absorb * 0.4 : evaporate * 0.35;
    this.flameMaterials.dissolve.value = departure > 0 ? 0 : evaporate;
    this.flameMaterials.glyphStrength.value = (0.8 + density * 0.2) * ignite * (1 - smooth(1.9, 2.6, departure));
  }

  private sampleDebris(departure: number): void {
    const absorbing = departure > 1.8;
    const time = absorbing ? departure - 1.8 : this.elapsed;
    const duration = absorbing ? 0.65 : SUMMONING_DURATION * 0.325;
    this.debris.visible = time < duration;
    if (!this.debris.visible) return;
    const progress = Math.min(1, time / duration);
    for (let index = 0; index < this.debris.count; index++) {
      const angle = index * 2.399;
      const radius = 0.85 + (absorbing ? -0.25 : 0.25) * progress;
      this.fragment.position.set(
        Math.cos(angle) * radius,
        0.07 + Math.sin(progress * Math.PI) * (0.12 + (index % 4) * 0.035),
        Math.sin(angle) * radius,
      );
      this.fragment.rotation.set(progress * 5, angle, progress * 3);
      this.fragment.scale.setScalar((0.025 + (index % 3) * 0.014) * (1 - smooth(0.5, 1, progress)));
      this.fragment.updateMatrix();
      this.debris.setMatrixAt(index, this.fragment.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;
  }
}
