import {
  Vector3,
  Scene,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  AdditiveBlending,
} from "three";

// Types
export interface TrailConfig {
  type: "dust" | "wake";
  color: { r: number; g: number; b: number };
  size: number;
  lifetime: number;
}

export interface TrailParticle {
  age: number;
  lifetime: number;
  opacity: number;
  active: boolean;
}

// Pure functions for testing
export function resolveTrailConfig(biomeType: string): TrailConfig {
  const isOcean = biomeType === "Ocean" || biomeType === "DeepOcean";
  if (isOcean) {
    return {
      type: "wake",
      color: { r: 0.8, g: 0.9, b: 1.0 },
      size: 0.2,
      lifetime: 0.8,
    };
  }
  return {
    type: "dust",
    color: { r: 0.76, g: 0.7, b: 0.5 },
    size: 0.15,
    lifetime: 0.6,
  };
}

export function updateTrailParticle(particle: TrailParticle, deltaTime: number): TrailParticle {
  const newAge = particle.age + deltaTime;
  const lifeRatio = newAge / particle.lifetime;
  const active = lifeRatio < 1;
  const opacity = active ? Math.max(0, 1 - lifeRatio) : 0;
  return { age: newAge, lifetime: particle.lifetime, opacity, active };
}

// Full emitter class
const MAX_PARTICLES = 200;

export class MovementTrailEmitter {
  private particles: TrailParticle[] = [];
  private positions: Float32Array;
  private opacities: Float32Array;
  private geometry: BufferGeometry;
  private points: Points;
  private writeIndex = 0;

  constructor(scene: Scene) {
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.opacities = new Float32Array(MAX_PARTICLES);
    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      age: 0,
      lifetime: 0,
      opacity: 0,
      active: false,
    }));

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3));

    const material = new PointsMaterial({
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    this.points = new Points(this.geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(position: Vector3, velocity: Vector3, biomeType: string): void {
    const config = resolveTrailConfig(biomeType);
    const idx = this.writeIndex % MAX_PARTICLES;

    // Set position with slight random spread
    const spread = config.type === "wake" ? 0.15 : 0.1;
    this.positions[idx * 3] = position.x + (Math.random() - 0.5) * spread;
    this.positions[idx * 3 + 1] = position.y + 0.05;
    this.positions[idx * 3 + 2] = position.z + (Math.random() - 0.5) * spread;

    this.particles[idx] = {
      age: 0,
      lifetime: config.lifetime,
      opacity: 1,
      active: true,
    };

    this.writeIndex++;
  }

  update(deltaTime: number): void {
    let needsUpdate = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.particles[i].active) continue;
      this.particles[i] = updateTrailParticle(this.particles[i], deltaTime);

      if (!this.particles[i].active) {
        // Hide inactive particle
        this.positions[i * 3 + 1] = -1000;
        needsUpdate = true;
      } else {
        // Drift upward slightly (dust rises)
        this.positions[i * 3 + 1] += deltaTime * 0.3;
        needsUpdate = true;
      }
    }
    if (needsUpdate) {
      this.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as PointsMaterial).dispose();
    this.points.parent?.remove(this.points);
  }
}
