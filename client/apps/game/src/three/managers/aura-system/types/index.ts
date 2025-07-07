import * as THREE from "three";

export interface AuraConfig {
  groundAuraId: number;
  middleAuraId: number;
  particlesId: number;
}

export enum AuraPartType {
  GROUND = "ground",
  MIDDLE = "middle",
  PARTICLES = "particles",
}

export enum AnimationType {
  NONE = "none",
  ROTATE = "rotate",
  PULSE = "pulse",
  FLOAT = "float",
  SPIRAL = "spiral",
  WAVE = "wave",
}

export interface AuraPartConfig {
  id: number;
  type: AuraPartType;
  texturePath?: string;
  animations: AnimationType[];
  defaultAnimation: AnimationType;
  opacity?: number;
  size?: number;
  color?: THREE.Color;
  renderOrder?: number;
}

export interface AuraInstance {
  id: string;
  entityId: number;
  config: AuraConfig;
  parts: Map<AuraPartType, IAuraPart>;
  position: THREE.Vector3;
  isActive: boolean;
}

export interface AuraPart {
  type: AuraPartType;
  config: AuraPartConfig;
  mesh: THREE.Object3D;
  currentAnimation: AnimationType;
  animationState: any;
}

export interface IAuraPart {
  getMesh(): THREE.Object3D;
  getConfig(): AuraPartConfig;
  setAnimation(type: AnimationType): void;
  update(delta: number): void;
  setPosition(x: number, y: number, z: number): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

export interface AnimationConfig {
  speed: number;
  amplitude?: number;
  frequency?: number;
  direction?: THREE.Vector3;
}

export interface AuraAnimationState {
  time: number;
  progress: number;
  data: Record<string, any>;
}
