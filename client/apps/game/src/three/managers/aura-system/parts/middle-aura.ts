import * as THREE from "three";
import { AnimationFactory } from "../animations/animation-factory";
import { AnimationType, AuraPartConfig, AuraPartType } from "../types";
import { BasePart } from "./base-part";

export class MiddleAura extends BasePart {
  private static textureLoader = new THREE.TextureLoader();
  private static textureCache = new Map<string, THREE.Texture>();
  private cylinderGroup: THREE.Group;
  private cylinders: THREE.Mesh[] = [];
  private cylinderAnimations: any[] = [];

  constructor(config: AuraPartConfig) {
    super(config);
    this.cylinderGroup = new THREE.Group();
    this.createCylinders();
    this.mesh = this.cylinderGroup;
    this.initializeCylinderAnimations();
  }

  private createCylinders(): void {
    const baseSize = this.config.size || 0.8;
    const baseOpacity = this.config.opacity || 0.5;

    // Create three cylinders with size variations
    const sizeVariations = [0.9, 1.0, 1.1]; // -5%, 0%, +5%
    const opacityVariations = [0.8, 1.0, 0.6]; // Different opacity for layering
    const heightOffsets = [0.0, 0.1, 0.2]; // Slight height variations

    for (let i = 0; i < 3; i++) {
      const cylinderSize = baseSize * sizeVariations[i];
      const cylinderOpacity = baseOpacity * opacityVariations[i];

      const geometry = new THREE.CylinderGeometry(cylinderSize, cylinderSize / 2, 1, 16, 1, true);

      const material = new THREE.MeshStandardMaterial({
        transparent: true,
        opacity: cylinderOpacity,
        color: this.config.color || 0xffffff,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
        emissive: 0xffffff,
        emissiveIntensity: 0.5,
      });

      if (this.config.texturePath) {
        const texture = this.loadTexture(this.config.texturePath);
        material.map = texture;
      }

      const cylinder = new THREE.Mesh(geometry, material);
      cylinder.position.y = 0.15 + heightOffsets[i];
      cylinder.renderOrder = (this.config.renderOrder || 15) + i;
      cylinder.receiveShadow = false;
      cylinder.castShadow = false;
      cylinder.raycast = () => {};

      this.cylinders.push(cylinder);
      this.cylinderGroup.add(cylinder);
    }
  }

  private initializeCylinderAnimations(): void {
    const speedVariations = [0.9, 1.0, 1.1]; // -10%, 0%, +10%

    for (let i = 0; i < this.cylinders.length; i++) {
      const baseConfig = AnimationFactory.getDefaultConfig(this.config.defaultAnimation);
      if (baseConfig) {
        const modifiedConfig = {
          ...baseConfig,
          speed: baseConfig.speed * speedVariations[i],
        };

        const animation = AnimationFactory.createAnimation(this.config.defaultAnimation, modifiedConfig);
        this.cylinderAnimations.push(animation);
      } else {
        this.cylinderAnimations.push(null);
      }
    }
  }

  public update(delta: number): void {
    // Update each cylinder with its own animation
    for (let i = 0; i < this.cylinders.length; i++) {
      const animation = this.cylinderAnimations[i];
      if (animation) {
        animation.update(delta, this.cylinders[i]);
      }
    }
  }

  public setAnimation(type: AnimationType): void {
    if (this.currentAnimationType === type) return;

    if (!this.config.animations.includes(type)) {
      console.warn(`Animation type ${type} not supported for ${this.config.type} part`);
      return;
    }

    this.currentAnimationType = type;

    // Update all cylinder animations
    const speedVariations = [0.9, 1.0, 1.1]; // -10%, 0%, +10%

    for (let i = 0; i < this.cylinders.length; i++) {
      const baseConfig = AnimationFactory.getDefaultConfig(type);
      if (baseConfig) {
        const modifiedConfig = {
          ...baseConfig,
          speed: baseConfig.speed * speedVariations[i],
        };

        this.cylinderAnimations[i] = AnimationFactory.createAnimation(type, modifiedConfig);
      }
    }
  }

  private loadTexture(path: string): THREE.Texture {
    if (MiddleAura.textureCache.has(path)) {
      return MiddleAura.textureCache.get(path)!;
    }

    const texture = MiddleAura.textureLoader.load(path);
    MiddleAura.textureCache.set(path, texture);
    return texture;
  }

  public dispose(): void {
    this.cylinders.forEach((cylinder) => {
      cylinder.geometry.dispose();
      if (cylinder.material instanceof THREE.Material) {
        cylinder.material.dispose();
      }
    });

    this.cylinders = [];
    this.cylinderAnimations = [];

    super.dispose();
  }

  public static getDefaultConfig(id: number): AuraPartConfig {
    return {
      id,
      type: AuraPartType.MIDDLE,
      texturePath: `/textures/auras/middle/${id}.png`,
      animations: [AnimationType.ROTATE, AnimationType.FLOAT, AnimationType.PULSE],
      defaultAnimation: AnimationType.ROTATE,
      opacity: 0.75,
      size: 0.9,
      renderOrder: 21,
    };
  }
}
