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
  private pointsPositions: Float32Array;
  private particleVelocities: Float32Array;
  private particleAngles: Float32Array;
  private points!: THREE.Points;
  private scene: THREE.Scene;

  constructor(config: AuraPartConfig, scene: THREE.Scene) {
    super(config);
    this.scene = scene;

    this.pointsPositions = new Float32Array(PARTICLES_COUNT * 3);
    this.particleVelocities = new Float32Array(PARTICLES_COUNT);
    this.particleAngles = new Float32Array(PARTICLES_COUNT);

    this.initializeParticles();
    this.createParticleMesh();
    this.mesh = this.points;
  }

  private initializeParticles(): void {
    for (let i = 0; i < PARTICLES_COUNT; i++) {
      this.particleAngles[i] = (i / PARTICLES_COUNT) * Math.PI * 2;

      this.pointsPositions[i * 3] = Math.cos(this.particleAngles[i]) * PARTICLE_RADIUS;
      this.pointsPositions[i * 3 + 2] = Math.sin(this.particleAngles[i]) * PARTICLE_RADIUS;

      this.particleVelocities[i] = Math.random();
      this.pointsPositions[i * 3 + 1] =
        PARTICLE_START_Y + (PARTICLE_RESET_Y - PARTICLE_START_Y) * this.particleVelocities[i];
    }
  }

  private createParticleMesh(): void {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.pointsPositions, 3));

    const material = new THREE.PointsMaterial({
      color: this.config.color || PARTICLE_COLOR,
      size: this.config.size || 0.2,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.renderOrder = this.config.renderOrder || 10;
  }

  public update(delta: number): void {
    super.update(delta);

    const clampedDelta = Math.min(delta, MAX_DELTA);

    for (let i = 0; i < PARTICLES_COUNT; i++) {
      this.particleVelocities[i] += PARTICLE_BASE_SPEED * clampedDelta;

      this.pointsPositions[i * 3 + 1] =
        PARTICLE_START_Y + (PARTICLE_RESET_Y - PARTICLE_START_Y) * this.particleVelocities[i];

      if (this.particleVelocities[i] >= 1.0) {
        this.particleVelocities[i] = Math.random() * 0.3;
        this.pointsPositions[i * 3 + 1] = PARTICLE_START_Y;
      }

      this.pointsPositions[i * 3] = Math.cos(this.particleAngles[i]) * PARTICLE_RADIUS;
      this.pointsPositions[i * 3 + 2] = Math.sin(this.particleAngles[i]) * PARTICLE_RADIUS;
    }

    this.points.geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.pointsPositions, 3));
  }

  public setPosition(x: number, y: number, z: number): void {
    super.setPosition(x, y, z);

    if (!this.scene.children.includes(this.points)) {
      this.scene.add(this.points);
    }
  }

  public setVisible(visible: boolean): void {
    super.setVisible(visible);

    if (visible) {
      if (!this.scene.children.includes(this.points)) {
        this.scene.add(this.points);
      }
    } else {
      if (this.scene.children.includes(this.points)) {
        this.scene.remove(this.points);
      }
    }
  }

  public dispose(): void {
    if (this.scene.children.includes(this.points)) {
      this.scene.remove(this.points);
    }

    this.points.geometry.dispose();
    if (this.points.material instanceof THREE.Material) {
      this.points.material.dispose();
    }

    super.dispose();
  }

  public setParticleSize(size: number): void {
    const material = this.points.material as THREE.PointsMaterial;
    material.size = size;
    material.needsUpdate = true;
  }

  public setParticleColor(color: THREE.Color): void {
    const material = this.points.material as THREE.PointsMaterial;
    material.color = color;
    material.needsUpdate = true;
  }

  public static getDefaultConfig(id: number): AuraPartConfig {
    return {
      id,
      type: AuraPartType.PARTICLES,
      animations: [AnimationType.WAVE, AnimationType.SPIRAL],
      defaultAnimation: AnimationType.WAVE,
      opacity: 1.0,
      size: 0.2,
      color: PARTICLE_COLOR,
      renderOrder: 10,
    };
  }
}
