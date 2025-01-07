import * as THREE from "three";
import { Particles } from "./Particles";

export class SelectedHexManager {
  private particles: Particles;

  constructor(scene: THREE.Scene) {
    this.particles = new Particles(scene);
    this.particles.setParticleSize(0.2);
    this.particles.setLightIntensity(1);
  }

  setPosition(x: number, z: number) {
    this.particles.setPosition(x, 0.1, z);
  }

  resetPosition() {
    this.particles.resetPosition();
  }

  update(deltaTime: number) {
    this.particles.update(deltaTime);
  }
}
