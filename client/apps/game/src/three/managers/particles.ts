import * as THREE from "three";

// particle constants
const PARTICLES_COUNT = 30;
const PARTICLE_BASE_SPEED = 0.75; // units per second
const PARTICLE_RESET_Y = 2.5;
const PARTICLE_START_Y = -0.5;
const PARTICLE_RADIUS = 0.7; // radius of the circle
const LIGHT_COLOR = new THREE.Color(2, 2, 1);
const PARICLE_COLOR = new THREE.Color(8, 8, 4);

const LIGHT_INTENSITY = 10;

const MAX_DELTA = 1 / 120; // Cap at 30 FPS equivalent to prevent large jumps

export class Particles {
  private pointsPositions: Float32Array;
  private particleVelocities: Float32Array;
  private particleAngles: Float32Array; // Store fixed angles for each particle
  private points: THREE.Points;
  private light: THREE.PointLight;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.pointsPositions = new Float32Array(PARTICLES_COUNT * 3);
    this.particleVelocities = new Float32Array(PARTICLES_COUNT);
    this.particleAngles = new Float32Array(PARTICLES_COUNT);

    // Initialize particles in a circle with random heights
    for (let i = 0; i < PARTICLES_COUNT; i++) {
      // Assign fixed angle for each particle
      this.particleAngles[i] = (i / PARTICLES_COUNT) * Math.PI * 2;

      // Set initial circular position
      this.pointsPositions[i * 3] = Math.cos(this.particleAngles[i]) * PARTICLE_RADIUS;
      this.pointsPositions[i * 3 + 2] = Math.sin(this.particleAngles[i]) * PARTICLE_RADIUS;

      // Randomize initial velocities for natural dispersion
      this.particleVelocities[i] = Math.random();
      this.pointsPositions[i * 3 + 1] =
        PARTICLE_START_Y + (PARTICLE_RESET_Y - PARTICLE_START_Y) * this.particleVelocities[i];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.pointsPositions, 3));

    const material = new THREE.PointsMaterial({
      color: PARICLE_COLOR,
      size: 0.2,
      sizeAttenuation: true,
    });

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
    const clampedDelta = Math.min(delta, MAX_DELTA);

    for (let i = 0; i < PARTICLES_COUNT; i++) {
      // Update particle progress
      this.particleVelocities[i] += PARTICLE_BASE_SPEED * clampedDelta;

      // Update Y position based on velocity
      this.pointsPositions[i * 3 + 1] =
        PARTICLE_START_Y + (PARTICLE_RESET_Y - PARTICLE_START_Y) * this.particleVelocities[i];

      // Reset particle when it reaches the top with random initial velocity
      if (this.particleVelocities[i] >= 1.0) {
        this.particleVelocities[i] = Math.random() * 0.3; // Start with random progress (0-30%)
        this.pointsPositions[i * 3 + 1] = PARTICLE_START_Y;
      }

      // Use stored angle for circular position
      this.pointsPositions[i * 3] = Math.cos(this.particleAngles[i]) * PARTICLE_RADIUS;
      this.pointsPositions[i * 3 + 2] = Math.sin(this.particleAngles[i]) * PARTICLE_RADIUS;
    }

    this.points.geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.pointsPositions, 3));
  }

  public dispose(): void {
    console.log("🧹 Particles: Starting disposal");
    
    // Remove from scene
    if (this.points.parent) {
      this.points.parent.remove(this.points);
    }
    if (this.light.parent) {
      this.light.parent.remove(this.light);
    }
    
    // Dispose geometry and material
    if (this.points.geometry) {
      this.points.geometry.dispose();
    }
    if (this.points.material) {
      (this.points.material as THREE.PointsMaterial).dispose();
    }
    
    // Clear arrays
    this.pointsPositions = new Float32Array();
    this.particleVelocities = new Float32Array(); 
    this.particleAngles = new Float32Array();
    
    console.log("🧹 Particles: Disposed geometry, material, and cleaned up");
  }
}
