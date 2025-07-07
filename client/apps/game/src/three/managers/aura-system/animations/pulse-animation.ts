import * as THREE from "three";
import { AnimationConfig, AnimationType } from "../types";
import { BaseAnimation } from "./base-animation";

export class PulseAnimation extends BaseAnimation {
  private initialScale: THREE.Vector3;
  private amplitude: number;

  constructor(config: AnimationConfig) {
    super(AnimationType.PULSE, config);
    this.amplitude = config.amplitude || 0.2;
    this.initialScale = new THREE.Vector3();
  }

  update(delta: number, mesh: THREE.Object3D): void {
    this.updateTime(delta);

    if (!this.state.data.initialized) {
      this.initialScale.copy(mesh.scale);
      this.state.data.initialized = true;
    }

    const pulseValue = Math.sin(this.state.progress * Math.PI * 2) * this.amplitude;
    const scaleFactor = 1 + pulseValue;

    mesh.scale.copy(this.initialScale).multiplyScalar(scaleFactor);
  }
}
