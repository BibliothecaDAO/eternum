import * as THREE from "three";
import { AnimationType, AuraPartConfig, AuraPartType } from "../types";
import { BasePart } from "./base-part";

const PARTICLES_COUNT = 30;
const PARTICLE_BASE_SPEED = 0.75;
const PARTICLE_RESET_Y = 2.5;
const PARTICLE_START_Y = -0.5;
const PARTICLE_RADIUS = 0.7;
const PARTICLE_COLOR = new THREE.Color(8, 8, 4);
const MAX_DELTA = 1 / 120;

export class ParticlesAura extends BasePart {
  private static textureLoader = new THREE.TextureLoader();
  private static textureCache = new Map<string, THREE.Texture>();

  private particleGroup: THREE.Group;
  private particles: THREE.Sprite[] = [];
  private particleVelocities: Float32Array;
  private particleAngles: Float32Array;
  private particlePositions: Float32Array;
  private scene: THREE.Scene;

  constructor(config: AuraPartConfig, scene: THREE.Scene) {
    super(config);
    this.scene = scene;

    this.particleGroup = new THREE.Group();
    this.particleVelocities = new Float32Array(PARTICLES_COUNT);
    this.particleAngles = new Float32Array(PARTICLES_COUNT);
    this.particlePositions = new Float32Array(PARTICLES_COUNT * 3);

    this.initializeParticles();
    this.createParticleSprites();
    this.mesh = this.particleGroup;
  }

  private initializeParticles(): void {
    for (let i = 0; i < PARTICLES_COUNT; i++) {
      this.particleAngles[i] = (i / PARTICLES_COUNT) * Math.PI * 2;

      this.particlePositions[i * 3] = Math.cos(this.particleAngles[i]) * PARTICLE_RADIUS;
      this.particlePositions[i * 3 + 2] = Math.sin(this.particleAngles[i]) * PARTICLE_RADIUS;

      this.particleVelocities[i] = Math.random();
      this.particlePositions[i * 3 + 1] =
        PARTICLE_START_Y + (PARTICLE_RESET_Y - PARTICLE_START_Y) * this.particleVelocities[i];
    }
  }

  private createParticleSprites(): void {
    const material = new THREE.SpriteMaterial({
      color: this.config.color || PARTICLE_COLOR,
      transparent: true,
      opacity: this.config.opacity || 1.0,
      alphaTest: 0.1,
    });

    if (this.config.texturePath) {
      const texture = this.loadTexture(this.config.texturePath);
      material.map = texture;
    }

    for (let i = 0; i < PARTICLES_COUNT; i++) {
      const sprite = new THREE.Sprite(material.clone());
      sprite.scale.setScalar(this.config.size || 0.2);
      sprite.renderOrder = this.config.renderOrder || 10;

      sprite.position.set(
        this.particlePositions[i * 3],
        this.particlePositions[i * 3 + 1],
        this.particlePositions[i * 3 + 2],
      );

      this.particles.push(sprite);
      this.particleGroup.add(sprite);
    }
  }

  private loadTexture(path: string): THREE.Texture {
    if (ParticlesAura.textureCache.has(path)) {
      return ParticlesAura.textureCache.get(path)!;
    }

    const texture = ParticlesAura.textureLoader.load(path);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    ParticlesAura.textureCache.set(path, texture);
    return texture;
  }

  public update(delta: number): void {
    super.update(delta);

    const clampedDelta = Math.min(delta, MAX_DELTA);

    for (let i = 0; i < PARTICLES_COUNT; i++) {
      this.particleVelocities[i] += PARTICLE_BASE_SPEED * clampedDelta;

      this.particlePositions[i * 3 + 1] =
        PARTICLE_START_Y + (PARTICLE_RESET_Y - PARTICLE_START_Y) * this.particleVelocities[i];

      if (this.particleVelocities[i] >= 1.0) {
        this.particleVelocities[i] = Math.random() * 0.3;
        this.particlePositions[i * 3 + 1] = PARTICLE_START_Y;
      }

      this.particlePositions[i * 3] = Math.cos(this.particleAngles[i]) * PARTICLE_RADIUS;
      this.particlePositions[i * 3 + 2] = Math.sin(this.particleAngles[i]) * PARTICLE_RADIUS;

      this.particles[i].position.set(
        this.particlePositions[i * 3],
        this.particlePositions[i * 3 + 1],
        this.particlePositions[i * 3 + 2],
      );
    }
  }

  public setPosition(x: number, y: number, z: number): void {
    super.setPosition(x, y, z);

    if (!this.scene.children.includes(this.particleGroup)) {
      this.scene.add(this.particleGroup);
    }
  }

  public setVisible(visible: boolean): void {
    super.setVisible(visible);

    if (visible) {
      if (!this.scene.children.includes(this.particleGroup)) {
        this.scene.add(this.particleGroup);
      }
    } else {
      if (this.scene.children.includes(this.particleGroup)) {
        this.scene.remove(this.particleGroup);
      }
    }
  }

  public dispose(): void {
    if (this.scene.children.includes(this.particleGroup)) {
      this.scene.remove(this.particleGroup);
    }

    this.particles.forEach((sprite) => {
      if (sprite.material instanceof THREE.Material) {
        sprite.material.dispose();
      }
    });

    this.particles = [];
    super.dispose();
  }

  public setParticleSize(size: number): void {
    this.particles.forEach((sprite) => {
      sprite.scale.setScalar(size);
    });
  }

  public setParticleColor(color: THREE.Color): void {
    this.particles.forEach((sprite) => {
      const material = sprite.material as THREE.SpriteMaterial;
      material.color = color;
      material.needsUpdate = true;
    });
  }

  public setTexture(texturePath: string): void {
    const texture = this.loadTexture(texturePath);
    this.particles.forEach((sprite) => {
      const material = sprite.material as THREE.SpriteMaterial;
      material.map = texture;
      material.needsUpdate = true;
    });
  }

  public static getDefaultConfig(id: number): AuraPartConfig {
    return {
      id,
      type: AuraPartType.PARTICLES,
      texturePath: `/textures/auras/particles/${id}.png`,
      animations: [AnimationType.WAVE, AnimationType.SPIRAL],
      defaultAnimation: AnimationType.WAVE,
      opacity: 1.0,
      size: 0.2,
      color: PARTICLE_COLOR,
      renderOrder: 10,
    };
  }
}
