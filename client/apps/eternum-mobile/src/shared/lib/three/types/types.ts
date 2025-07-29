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
