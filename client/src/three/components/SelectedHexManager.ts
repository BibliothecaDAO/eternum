import * as THREE from "three";
import { Aura } from "./Aura";
import { Particles } from "./Particles";

export class SelectedHexManager {
  private aura: Aura;
  private particles: Particles;

  constructor(scene: THREE.Scene) {
    this.aura = new Aura();
    this.aura.addToScene(scene);
    this.particles = new Particles(scene);
    this.particles.setParticleSize(0.1);
    this.particles.setLightIntensity(5);
  }

  setPosition(x: number, z: number) {
    this.aura.setPosition(x, 0.19, z);
    this.particles.setPosition(x, 0.1, z);
  }

  update(deltaTime: number) {
    this.aura.rotate();
    this.particles.update(deltaTime);
  }
}
