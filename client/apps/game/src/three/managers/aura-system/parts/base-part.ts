import * as THREE from "three";
import { AnimationFactory } from "../animations/animation-factory";
import { BaseAnimation } from "../animations/base-animation";
import { AnimationType, AuraPartConfig, IAuraPart } from "../types";

export abstract class BasePart implements IAuraPart {
  protected config: AuraPartConfig;
  protected mesh!: THREE.Object3D;
  protected currentAnimation: BaseAnimation | null = null;
  protected currentAnimationType: AnimationType;

  constructor(config: AuraPartConfig) {
    this.config = config;
    this.currentAnimationType = config.defaultAnimation;
    this.currentAnimation = AnimationFactory.createAnimation(config.defaultAnimation);
  }

  public getMesh(): THREE.Object3D {
    return this.mesh;
  }

  public getConfig(): AuraPartConfig {
    return this.config;
  }

  public setAnimation(type: AnimationType): void {
    if (this.currentAnimationType === type) return;

    if (!this.config.animations.includes(type)) {
      console.warn(`Animation type ${type} not supported for ${this.config.type} part`);
      return;
    }

    this.currentAnimationType = type;
    this.currentAnimation = AnimationFactory.createAnimation(type);
  }

  public update(delta: number): void {
    if (this.currentAnimation) {
      this.currentAnimation.update(delta, this.mesh);
    }
  }

  public setPosition(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y, z);
  }

  public setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  public dispose(): void {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    if (this.mesh instanceof THREE.Mesh) {
      this.mesh.geometry.dispose();
      if (this.mesh.material instanceof THREE.Material) {
        this.mesh.material.dispose();
      }
    }
  }
}
