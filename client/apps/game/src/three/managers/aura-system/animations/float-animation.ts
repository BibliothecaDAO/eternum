import * as THREE from "three";
import { AnimationConfig, AnimationType } from "../types";
import { BaseAnimation } from "./base-animation";

export class FloatAnimation extends BaseAnimation {
  private initialPosition: THREE.Vector3;
  private amplitude: number;

  constructor(config: AnimationConfig) {
    super(AnimationType.FLOAT, config);
    this.amplitude = config.amplitude || 0.1;
    this.initialPosition = new THREE.Vector3();
  }

  update(delta: number, mesh: THREE.Object3D): void {
    this.updateTime(delta);

    if (!this.state.data.initialized) {
      this.initialPosition.copy(mesh.position);
      this.state.data.initialized = true;
    }

    const floatValue = Math.sin(this.state.progress * Math.PI * 2) * this.amplitude;

    mesh.position.copy(this.initialPosition);
    mesh.position.y += floatValue;
  }
}
