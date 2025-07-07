import * as THREE from "three";
import { AnimationType, AuraPartConfig, AuraPartType } from "../types";
import { BasePart } from "./base-part";

export class MiddleAura extends BasePart {
  private static textureLoader = new THREE.TextureLoader();
  private static textureCache = new Map<string, THREE.Texture>();

  constructor(config: AuraPartConfig) {
    super(config);
    this.mesh = this.createMesh();
  }

  private createMesh(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(
      this.config.size || 0.8,
      (this.config.size || 0.8) / 2,
      2.5,
      16,
      1,
      true,
    );

    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: this.config.opacity || 0.5,
      color: this.config.color || 0xffffff,
      alphaTest: 0.075,
      side: THREE.DoubleSide,
    });

    if (this.config.texturePath) {
      const texture = this.loadTexture(this.config.texturePath);
      material.map = texture;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.75;
    mesh.renderOrder = this.config.renderOrder || 15;
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.raycast = () => {};

    return mesh;
  }

  private loadTexture(path: string): THREE.Texture {
    if (MiddleAura.textureCache.has(path)) {
      return MiddleAura.textureCache.get(path)!;
    }

    const texture = MiddleAura.textureLoader.load(path);
    MiddleAura.textureCache.set(path, texture);
    return texture;
  }

  public static getDefaultConfig(id: number): AuraPartConfig {
    return {
      id,
      type: AuraPartType.MIDDLE,
      texturePath: `/textures/auras/middle/${id}.png`,
      animations: [AnimationType.ROTATE, AnimationType.FLOAT, AnimationType.PULSE],
      defaultAnimation: AnimationType.ROTATE,
      opacity: 0.95,
      size: 0.8,
      renderOrder: 21,
    };
  }
}
