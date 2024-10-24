import * as THREE from "three";
import { Aura } from "./Aura";
import { Particles } from "./Particles";

export class SelectedHexManager {
  private aura: Aura;
  private particles: Particles;

  constructor(scene: THREE.Scene) {
    this.aura = new Aura();
    this.aura.setRenderOrder(0);
    this.aura.addToScene(scene);
    this.particles = new Particles(scene);
    this.particles.setParticleSize(0.3);
    this.particles.setLightIntensity(3);
  }

  setPosition(x: number, z: number) {
    //this.aura.setPosition(x, 0.19, z);
    this.particles.setPosition(x, 0.1, z);
  }

  resetPosition() {
    this.aura.resetPosition();
    this.particles.resetPosition();
  }

  update(deltaTime: number) {
    //this.aura.rotate();
    this.particles.update(deltaTime);
  }
}
