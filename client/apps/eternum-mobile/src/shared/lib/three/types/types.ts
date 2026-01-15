export interface SceneConfig {
  id: string;
  name: string;
  description?: string;
}

export interface RendererConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pixelRatio?: number;
}

export interface CameraConfig {
  position: [number, number, number];
  lookAt: [number, number, number];
  near: number;
  far: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ControlsConfig {
  enableDamping: boolean;
  dampingFactor: number;
  minDistance: number;
  maxDistance: number;
  enableRotate: boolean;
  enablePan: boolean;
  enableZoom: boolean;
}

export enum ModelType {
  Boat = "boat",
  Knight1 = "knight1",
  Knight2 = "knight2",
  Knight3 = "knight3",
  Crossbowman1 = "crossbowman1",
  Crossbowman2 = "crossbowman2",
  Crossbowman3 = "crossbowman3",
  Paladin1 = "paladin1",
  Paladin2 = "paladin2",
  Paladin3 = "paladin3",
  AgentApix = "apix",
  AgentElisa = "elisa",
  AgentIstarai = "istarai",
  AgentYP = "ypanther",
}
