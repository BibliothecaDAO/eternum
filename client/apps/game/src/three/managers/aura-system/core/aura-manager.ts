import * as THREE from "three";
import { GroundAura } from "../parts/ground-aura";
import { MiddleAura } from "../parts/middle-aura";
import { ParticlesAura } from "../parts/particles-aura";
import { AnimationType, AuraConfig, AuraInstance, AuraPartType, IAuraPart } from "../types";

export class AuraManager {
  private scene: THREE.Scene;
  private auras: Map<string, AuraInstance> = new Map();
  private entityAuras: Map<number, string> = new Map();
  private clock: THREE.Clock;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.clock = new THREE.Clock();
  }

  public createAura(entityId: number, config: AuraConfig): string {
    const auraId = `aura_${entityId}_${Date.now()}`;

    if (this.entityAuras.has(entityId)) {
      this.removeAura(entityId);
    }

    const parts = new Map<AuraPartType, IAuraPart>();

    const groundConfig = GroundAura.getDefaultConfig(config.groundAuraId);
    const groundAura = new GroundAura(groundConfig);
    parts.set(AuraPartType.GROUND, groundAura);

    const middleConfig = MiddleAura.getDefaultConfig(config.middleAuraId);
    const middleAura = new MiddleAura(middleConfig);
    parts.set(AuraPartType.MIDDLE, middleAura);

    const particlesConfig = ParticlesAura.getDefaultConfig(config.particlesId);
    const particlesAura = new ParticlesAura(particlesConfig, this.scene);
    parts.set(AuraPartType.PARTICLES, particlesAura);

    const auraInstance: AuraInstance = {
      id: auraId,
      entityId,
      config,
      parts,
      position: new THREE.Vector3(),
      isActive: true,
    };

    this.auras.set(auraId, auraInstance);
    this.entityAuras.set(entityId, auraId);

    parts.forEach((part) => {
      this.scene.add(part.getMesh());
    });

    return auraId;
  }

  public removeAura(entityId: number): boolean {
    const auraId = this.entityAuras.get(entityId);
    if (!auraId) return false;

    const aura = this.auras.get(auraId);
    if (!aura) return false;

    aura.parts.forEach((part) => {
      this.scene.remove(part.getMesh());
      part.dispose();
    });

    this.auras.delete(auraId);
    this.entityAuras.delete(entityId);

    return true;
  }

  public setAuraPosition(entityId: number, x: number, y: number, z: number): boolean {
    const auraId = this.entityAuras.get(entityId);
    if (!auraId) return false;

    const aura = this.auras.get(auraId);
    if (!aura) return false;

    aura.position.set(x, y, z);
    aura.parts.forEach((part) => {
      part.setPosition(x, y, z);
    });

    return true;
  }

  public setAuraAnimation(entityId: number, partType: AuraPartType, animationType: AnimationType): boolean {
    const auraId = this.entityAuras.get(entityId);
    if (!auraId) return false;

    const aura = this.auras.get(auraId);
    if (!aura) return false;

    const part = aura.parts.get(partType);
    if (!part) return false;

    part.setAnimation(animationType);
    return true;
  }

  public setAuraVisible(entityId: number, visible: boolean): boolean {
    const auraId = this.entityAuras.get(entityId);
    if (!auraId) return false;

    const aura = this.auras.get(auraId);
    if (!aura) return false;

    aura.isActive = visible;
    aura.parts.forEach((part) => {
      part.setVisible(visible);
    });

    return true;
  }

  public update(): void {
    const delta = this.clock.getDelta();

    this.auras.forEach((aura) => {
      if (aura.isActive) {
        aura.parts.forEach((part) => {
          part.update(delta);
        });
      }
    });
  }

  public getAuraByEntityId(entityId: number): AuraInstance | null {
    const auraId = this.entityAuras.get(entityId);
    return auraId ? this.auras.get(auraId) || null : null;
  }

  public hasAura(entityId: number): boolean {
    return this.entityAuras.has(entityId);
  }

  public dispose(): void {
    this.auras.forEach((aura) => {
      aura.parts.forEach((part) => {
        this.scene.remove(part.getMesh());
        part.dispose();
      });
    });

    this.auras.clear();
    this.entityAuras.clear();
  }
}
