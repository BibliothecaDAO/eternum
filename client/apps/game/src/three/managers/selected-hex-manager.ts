import { Particles } from "@/three/managers/particles";
import { FLAT_TERRAIN_SURFACE, type TerrainSurface } from "@/three/terrain/terrain-surface";
import * as THREE from "three";

export class SelectedHexManager {
  private particles: Particles;

  constructor(
    scene: THREE.Scene,
    private readonly terrainSurface: TerrainSurface = FLAT_TERRAIN_SURFACE,
  ) {
    this.particles = new Particles(scene);
    this.particles.setParticleSize(0.2);
    this.particles.setLightIntensity(1);
  }

  setPosition(x: number, z: number) {
    this.particles.setPosition(x, this.terrainSurface.sampleSurface(x, z).height + 0.1, z);
  }

  resetPosition() {
    this.particles.resetPosition();
  }

  update(deltaTime: number) {
    this.particles.update(deltaTime);
  }

  dispose() {
    this.particles.dispose();
  }
}
