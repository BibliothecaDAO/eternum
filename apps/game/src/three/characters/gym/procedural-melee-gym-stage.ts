import type { ProceduralMeleeContactEvent } from "@/three/characters";
import type { ProceduralMeleeConfig } from "@/three/characters/melee/procedural-melee-config";
import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from "three";

const ARC_SEGMENTS = 24;
const TARGET_LANE_OFFSET_X = -0.72;

/** Close-range target lane and contact diagnostics for melee authoring. */
export class ProceduralMeleeGymStage {
  public readonly group = new Group();

  private readonly target = new Group();
  private readonly targetVisual = new Group();
  private readonly armorMaterial = new MeshStandardMaterial({
    color: 0x748296,
    emissive: 0x000000,
    metalness: 0.76,
    roughness: 0.34,
  });
  private readonly arcPositions = new Float32Array((ARC_SEGMENTS + 1) * 3);
  private readonly arcGeometry = new BufferGeometry();
  private readonly arcMaterial = new LineBasicMaterial({ color: 0xffcb7d, opacity: 0.82, transparent: true });
  private readonly arc: Line;
  private readonly targetPosition = new Vector3();
  private readonly recoilOffset = new Vector3();
  private readonly recoilVelocity = new Vector3();
  private config: ProceduralMeleeConfig;
  private elapsedSeconds = 0;
  private impactFlashSeconds = 0;
  private contactCount = 0;

  public constructor(config: ProceduralMeleeConfig) {
    this.config = config;
    this.group.name = "procedural-melee-gym-stage";
    this.target.name = "procedural-melee-target";
    this.targetVisual.name = "procedural-melee-target-visual";
    this.createTarget();
    this.arcGeometry.setAttribute("position", new Float32BufferAttribute(this.arcPositions, 3));
    this.arc = new Line(this.arcGeometry, this.arcMaterial);
    this.arc.name = "procedural-melee-contact-arc";
    this.arc.frustumCulled = false;
    this.target.add(this.targetVisual);
    this.group.add(this.target, this.arc);
    this.updateConfig(config);
    this.update(0);
  }

  public update(deltaSeconds: number): void {
    const elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    this.elapsedSeconds += elapsed;
    const phase = this.elapsedSeconds * this.config.targetSpeed;
    this.targetPosition.set(
      TARGET_LANE_OFFSET_X + Math.sin(phase) * this.config.targetMovement,
      this.config.targetHeight,
      this.config.targetDistance,
    );
    this.target.position.copy(this.targetPosition);
    this.recoilVelocity.addScaledVector(this.recoilOffset, -36 * elapsed);
    this.recoilVelocity.multiplyScalar(Math.exp(-10 * elapsed));
    this.recoilOffset.addScaledVector(this.recoilVelocity, elapsed);
    this.targetVisual.position.copy(this.recoilOffset);
    this.targetVisual.rotation.z = -this.recoilOffset.x * 0.32;
    this.targetVisual.rotation.x = this.recoilOffset.z * 0.28;
    this.impactFlashSeconds = Math.max(0, this.impactFlashSeconds - elapsed);
    this.armorMaterial.emissive.set(this.impactFlashSeconds > 0 ? 0xff7a32 : 0x000000);
    this.armorMaterial.emissiveIntensity = this.impactFlashSeconds > 0 ? 2.8 : 0;
    this.arcMaterial.opacity = Math.max(0, Math.min(0.82, this.impactFlashSeconds * 4));
  }

  public updateConfig(config: ProceduralMeleeConfig): void {
    this.config = config;
    this.arc.visible = config.showArc;
    this.update(0);
  }

  public writeTargetPosition(out: Vector3): Vector3 {
    return out.copy(this.targetPosition);
  }

  public registerContact(event: ProceduralMeleeContactEvent): void {
    this.contactCount += 1;
    this.impactFlashSeconds = 0.26;
    this.recoilVelocity.addScaledVector(event.direction, event.impactStrength * 0.52);
    this.writeContactArc(event.origin, event.target, event.direction);
  }

  public getContactCount(): number {
    return this.contactCount;
  }

  public reset(): void {
    this.elapsedSeconds = 0;
    this.impactFlashSeconds = 0;
    this.contactCount = 0;
    this.recoilOffset.set(0, 0, 0);
    this.recoilVelocity.set(0, 0, 0);
    this.arcMaterial.opacity = 0;
    this.update(0);
  }

  public dispose(): void {
    this.group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material !== this.armorMaterial) material.dispose();
      });
    });
    this.armorMaterial.dispose();
    this.arcGeometry.dispose();
    this.arcMaterial.dispose();
    this.group.clear();
    this.group.removeFromParent();
  }

  private createTarget(): void {
    const leather = new MeshStandardMaterial({ color: 0x49372d, metalness: 0.05, roughness: 0.86 });
    const darkMetal = new MeshStandardMaterial({ color: 0x252d38, metalness: 0.82, roughness: 0.38 });
    const accent = new MeshStandardMaterial({ color: 0x9f3e35, metalness: 0.22, roughness: 0.62 });
    const torso = new Mesh(new CylinderGeometry(0.3, 0.38, 0.82, 10), this.armorMaterial);
    torso.position.y = 0.08;
    const chestPlate = new Mesh(new BoxGeometry(0.58, 0.42, 0.12), this.armorMaterial);
    chestPlate.position.set(0, 0.16, -0.29);
    const head = new Mesh(new SphereGeometry(0.22, 14, 10), darkMetal);
    head.position.y = 0.7;
    const helm = new Mesh(new ConeGeometry(0.25, 0.3, 8), darkMetal);
    helm.position.y = 0.91;
    const sash = new Mesh(new BoxGeometry(0.55, 0.11, 0.4), accent);
    sash.position.y = -0.2;
    const post = new Mesh(new CylinderGeometry(0.055, 0.075, 1.18, 8), leather);
    post.position.y = -0.82;
    const base = new Mesh(new CylinderGeometry(0.42, 0.5, 0.12, 12), darkMetal);
    base.position.y = -1.43;
    [torso, chestPlate, head, helm, sash, post, base].forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    this.targetVisual.add(torso, chestPlate, head, helm, sash, post, base);
  }

  private writeContactArc(origin: Readonly<Vector3>, target: Readonly<Vector3>, direction: Readonly<Vector3>): void {
    const sideSign = direction.x >= 0 ? 1 : -1;
    for (let index = 0; index <= ARC_SEGMENTS; index += 1) {
      const progress = index / ARC_SEGMENTS;
      const offset = index * 3;
      const sideSweep = Math.sin(progress * Math.PI) * 0.32 * sideSign;
      this.arcPositions[offset] = origin.x + (target.x - origin.x) * progress + sideSweep;
      this.arcPositions[offset + 1] = origin.y + (target.y - origin.y) * progress + Math.sin(progress * Math.PI) * 0.24;
      this.arcPositions[offset + 2] = origin.z + (target.z - origin.z) * progress;
    }
    const position = this.arcGeometry.getAttribute("position");
    position.needsUpdate = true;
    this.arcGeometry.computeBoundingSphere();
  }
}
