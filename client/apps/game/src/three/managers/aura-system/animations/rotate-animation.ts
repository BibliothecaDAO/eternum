import * as THREE from "three";
import { AnimationConfig, AnimationType } from "../types";
import { BaseAnimation } from "./base-animation";

export class RotateAnimation extends BaseAnimation {
  private axis: THREE.Vector3;
  private initialRotation: THREE.Euler;

  constructor(config: AnimationConfig) {
    super(AnimationType.ROTATE, config);
    this.axis = config.direction || new THREE.Vector3(0, 1, 0);
    this.initialRotation = new THREE.Euler();
  }

  update(delta: number, mesh: THREE.Object3D): void {
    this.updateTime(delta);

    if (!this.state.data.initialized) {
      this.initialRotation.copy(mesh.rotation);
      this.state.data.initialized = true;
    }

    const rotationAmount = this.state.progress * Math.PI * 2;

    if (this.axis.y !== 0) {
      mesh.rotation.y = this.initialRotation.y + rotationAmount;
    }
    if (this.axis.x !== 0) {
      mesh.rotation.x = this.initialRotation.x + rotationAmount;
    }
    if (this.axis.z !== 0) {
      mesh.rotation.z = this.initialRotation.z + rotationAmount;
    }
  }
}
