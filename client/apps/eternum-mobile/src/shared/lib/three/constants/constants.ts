import type { CameraConfig, ControlsConfig, SceneConfig } from "./types";

export const DEFAULT_SCENES: SceneConfig[] = [
  {
    id: "worldmap",
    name: "World Map",
    description: "Large world overview with ground plane",
  },
  {
    id: "detail",
    name: "Detailed View",
    description: "Detailed view with objects and smaller plane",
  },
  {
    id: "test",
    name: "Test Scene",
    description: "Development and testing scene",
  },
];

export const CAMERA_CONFIG: CameraConfig = {
  position: [0, 10, 0],
  lookAt: [0, 0, 0],
  near: 0.1,
  far: 1000,
  left: -10,
  right: 10,
  top: 10,
  bottom: -10,
};

export const RENDERER_CONFIG = {
  antialias: true,
  alpha: true,
  powerPreference: "high-performance" as const,
  preserveDrawingBuffer: false,
  stencil: false,
  depth: true,
};

export const CONTROLS_CONFIG: ControlsConfig = {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 1,
  maxDistance: 50,
  enableRotate: false, // Keep top-down view
  enablePan: true,
  enableZoom: true,
};

export const SCENE_COLORS = {
  worldmap: {
    plane: 0x808080, // Gray
    box: 0x4a90e2, // Blue
  },
  detail: {
    plane: 0x666666, // Dark gray
    box: 0xe74c3c, // Red
  },
  test: {
    plane: 0x999999, // Light gray
    box: 0x2ecc71, // Green
  },
};

export const PROGRESS_HALF_THRESHOLD = 50;
export const PROGRESS_FINAL_THRESHOLD = 100;
