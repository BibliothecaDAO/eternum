import * as THREE from "three";
import { AnimationType, AuraPartConfig, AuraPartType } from "../types";
import { BasePart } from "./base-part";

export class GroundAura extends BasePart {
  private static textureLoader = new THREE.TextureLoader();
  private static textureCache = new Map<string, THREE.Texture>();

  constructor(config: AuraPartConfig) {
    super(config);
    this.mesh = this.createMesh();
  }

  private createMesh(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(this.config.size || 1.8, this.config.size || 1.8);

    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: this.config.opacity || 0.8,
      color: this.config.color || 0xffffff,
      alphaTest: 0.075,
    });

    if (this.config.texturePath) {
      const texture = this.loadTexture(this.config.texturePath);
      material.map = texture;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = this.config.renderOrder || 20;
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.raycast = () => {};

    return mesh;
  }

  private loadTexture(path: string): THREE.Texture {
    if (GroundAura.textureCache.has(path)) {
      return GroundAura.textureCache.get(path)!;
    }

    const texture = GroundAura.textureLoader.load(path);
    GroundAura.textureCache.set(path, texture);
    return texture;
  }

  public static getDefaultConfig(id: number): AuraPartConfig {
    return {
      id,
      type: AuraPartType.GROUND,
      texturePath: `/textures/auras/ground/${id}.png`,
      animations: [AnimationType.ROTATE, AnimationType.PULSE],
      defaultAnimation: AnimationType.PULSE,
      opacity: 0.95,
      size: 1.8,
      renderOrder: 20,
    };
  }
}
