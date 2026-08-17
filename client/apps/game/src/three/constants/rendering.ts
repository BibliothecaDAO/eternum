import { IS_FLAT_MODE } from "@/ui/config";

export type RendererToneMappingMode = "aces-filmic" | "cineon" | "linear" | "neutral" | "reinhard";

export interface PostProcessingConfig {
  brightness: number;
  contrast: number;
  hue: number;
  saturation: number;
  toneMapping: {
    mode: RendererToneMappingMode;
    exposure: number;
    whitePoint: number;
  };
  vignette: {
    darkness: number;
    offset: number;
  };
  bloomIntensity: number;
}

export const CAMERA_CONFIG = {
  fov: 45,
  near: 0.1,
  far: {
    default: 30,
    flat: 50,
  },
  defaultDistance: 10,
  defaultAngle: Math.PI / 3,
};

export const CONTROL_CONFIG = {
  enableRotate: false,
  enablePan: true,
  enableDamping: true,
  zoomToCursor: true,
  minDistance: 5,
  maxDistance: 20,
  panSpeed: 2,
  dampingFactor: 0.05,
  keyPanSpeed: 75,
};

// Continuous zoom limits for the local (hexception) scene. The settings UI and the
// scene itself must agree on this range so persisted values can be clamped consistently.
export const LOCAL_CAMERA_ZOOM = {
  minDistance: CONTROL_CONFIG.minDistance,
  maxDistance: IS_FLAT_MODE ? 36 : 20,
  defaultDistance: 20,
};

export const FOG_CONFIG = {
  color: 0x1b1e2b,
  near: 15,
  far: 35,
};

export const POST_PROCESSING_CONFIG: PostProcessingConfig | null = null;

export const CAMERA_FAR_PLANE = IS_FLAT_MODE ? CAMERA_CONFIG.far.flat : CAMERA_CONFIG.far.default;
