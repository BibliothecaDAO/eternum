import * as THREE from "three";

// particle constants
const PARTICLES_COUNT = 30;
const PARTICLE_SPEED = 1;
const PARTICLE_RESET_Y = 2.5;
const PARTICLE_START_Y = -0.5;
const LIGHT_COLOR = new THREE.Color(2, 2, 1);
const PARICLE_COLOR = new THREE.Color("lightyellow");

//  particle position ranges
const PARTICLE_X_RANGE = 1;
const PARTICLE_Y_RANGE = 5;
const PARTICLE_Z_RANGE = 1;

const LIGHT_INTENSITY = 10;

export class Particles {
  private pointsPositions: Float32Array;
  private points: THREE.Points;
  private light: THREE.PointLight;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.pointsPositions = new Float32Array(PARTICLES_COUNT * 3);
    for (let i = 0; i < PARTICLES_COUNT; i++) {
      this.pointsPositions[i * 3] = Math.random() * PARTICLE_X_RANGE - PARTICLE_X_RANGE / 2; // x
      this.pointsPositions[i * 3 + 1] = Math.random() * PARTICLE_Y_RANGE - PARTICLE_Y_RANGE / 2; // y
      this.pointsPositions[i * 3 + 2] = Math.random() * PARTICLE_Z_RANGE - PARTICLE_Z_RANGE / 2; // z
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.pointsPositions, 3));

    const material = new THREE.PointsMaterial({ color: PARICLE_COLOR, size: 1 });

    this.points = new THREE.Points(geometry, material);

    this.light = new THREE.PointLight(LIGHT_COLOR, LIGHT_INTENSITY);

    this.scene = scene;
  }

  setPosition(x: number, y: number, z: number) {
    this.points.position.set(x, y, z);
    this.light.position.set(x, y + 1.5, z);

    // avoid having particles in position (0, 0, 0) at start
    if (!this.scene.children.includes(this.points)) {
      this.scene.add(this.points);
    }
    if (!this.scene.children.includes(this.light)) {
      this.scene.add(this.light);
    }
  }

  resetPosition() {
    this.points.position.set(0, 0, 0);
    this.light.position.set(0, 0, 0);
  }

  setParticleSize(size: number) {
    const material = this.points.material as THREE.PointsMaterial;
    material.size = size;
    material.needsUpdate = true;
  }

  setLightIntensity(intensity: number) {
    this.light.intensity = intensity;
  }

  update(delta: number) {
    for (let i = 0; i < PARTICLES_COUNT; i++) {
      this.pointsPositions[i * 3 + 1] += PARTICLE_SPEED * delta;
      if (this.pointsPositions[i * 3 + 1] > PARTICLE_RESET_Y) {
        this.pointsPositions[i * 3 + 1] = PARTICLE_START_Y;
      }
    }

    this.points.geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.pointsPositions, 3));
  }
}
