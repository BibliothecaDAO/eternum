import * as THREE from "three";
import { AnimationConfig, AnimationType, AuraAnimationState } from "../types";

export abstract class BaseAnimation {
  protected state: AuraAnimationState;
  protected config: AnimationConfig;
  protected type: AnimationType;

  constructor(type: AnimationType, config: AnimationConfig) {
    this.type = type;
    this.config = config;
    this.state = {
      time: 0,
      progress: 0,
      data: {},
    };
  }

  abstract update(delta: number, mesh: THREE.Object3D): void;

  protected updateTime(delta: number) {
    this.state.time += delta;
    this.state.progress = (this.state.time * this.config.speed) % 1;
  }

  public reset() {
    this.state.time = 0;
    this.state.progress = 0;
    this.state.data = {};
  }

  public getType(): AnimationType {
    return this.type;
  }

  public getState(): AuraAnimationState {
    return this.state;
  }
}
