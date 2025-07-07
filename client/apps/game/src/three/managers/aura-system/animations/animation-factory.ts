import * as THREE from "three";
import { AnimationConfig, AnimationType } from "../types";
import { BaseAnimation } from "./base-animation";
import { FloatAnimation } from "./float-animation";
import { PulseAnimation } from "./pulse-animation";
import { RotateAnimation } from "./rotate-animation";

export class AnimationFactory {
  private static animationConfigs: Map<AnimationType, AnimationConfig> = new Map([
    [AnimationType.ROTATE, { speed: 0.3, direction: { x: 0, y: 1, z: 0 } as any }],
    [AnimationType.PULSE, { speed: 0.5, amplitude: 0.1 }],
    [AnimationType.FLOAT, { speed: 0.8, amplitude: 0.1 }],
    [AnimationType.SPIRAL, { speed: 0.3, amplitude: 0.05 }],
    [AnimationType.WAVE, { speed: 0.6, amplitude: 0.08 }],
  ]);

  public static createAnimation(type: AnimationType, customConfig?: Partial<AnimationConfig>): BaseAnimation | null {
    const baseConfig = this.animationConfigs.get(type);
    if (!baseConfig) {
      return null;
    }

    const config = { ...baseConfig, ...customConfig };

    switch (type) {
      case AnimationType.ROTATE:
        return new RotateAnimation(config);
      case AnimationType.PULSE:
        return new PulseAnimation(config);
      case AnimationType.FLOAT:
        return new FloatAnimation(config);
      case AnimationType.SPIRAL:
        return new SpiralAnimation(config);
      case AnimationType.WAVE:
        return new WaveAnimation(config);
      case AnimationType.NONE:
      default:
        return null;
    }
  }

  public static getDefaultConfig(type: AnimationType): AnimationConfig | undefined {
    return this.animationConfigs.get(type);
  }

  public static setDefaultConfig(type: AnimationType, config: AnimationConfig): void {
    this.animationConfigs.set(type, config);
  }
}

class SpiralAnimation extends BaseAnimation {
  private initialPosition: THREE.Vector3;
  private amplitude: number;

  constructor(config: AnimationConfig) {
    super(AnimationType.SPIRAL, config);
    this.amplitude = config.amplitude || 0.05;
    this.initialPosition = new THREE.Vector3();
  }

  update(delta: number, mesh: THREE.Object3D): void {
    this.updateTime(delta);

    if (!this.state.data.initialized) {
      this.initialPosition.copy(mesh.position);
      this.state.data.initialized = true;
    }

    const angle = this.state.progress * Math.PI * 4;
    const spiralX = Math.cos(angle) * this.amplitude;
    const spiralZ = Math.sin(angle) * this.amplitude;
    const spiralY = Math.sin(this.state.progress * Math.PI * 2) * this.amplitude;

    mesh.position.copy(this.initialPosition);
    mesh.position.x += spiralX;
    mesh.position.y += spiralY;
    mesh.position.z += spiralZ;
  }
}

class WaveAnimation extends BaseAnimation {
  private initialPosition: THREE.Vector3;
  private amplitude: number;

  constructor(config: AnimationConfig) {
    super(AnimationType.WAVE, config);
    this.amplitude = config.amplitude || 0.08;
    this.initialPosition = new THREE.Vector3();
  }

  update(delta: number, mesh: THREE.Object3D): void {
    this.updateTime(delta);

    if (!this.state.data.initialized) {
      this.initialPosition.copy(mesh.position);
      this.state.data.initialized = true;
    }

    const waveY = Math.sin(this.state.progress * Math.PI * 2) * this.amplitude;
    const waveX = Math.cos(this.state.progress * Math.PI * 2) * this.amplitude * 0.5;

    mesh.position.copy(this.initialPosition);
    mesh.position.x += waveX;
    mesh.position.y += waveY;
  }
}
