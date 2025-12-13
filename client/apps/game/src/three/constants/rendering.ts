import { GraphicsSettings, IS_FLAT_MODE } from "@/ui/config";
import { ToneMappingMode } from "postprocessing";

export interface PostProcessingConfig {
  brightness: number;
  contrast: number;
  hue: number;
  saturation: number;
  toneMapping: {
    mode: ToneMappingMode;
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

export const FOG_CONFIG = {
  color: 0x1b1e2b,
  near: 15,
  far: 35,
};

export const POST_PROCESSING_CONFIG: Record<GraphicsSettings, PostProcessingConfig | null> = {
  [GraphicsSettings.HIGH]: {
    brightness: 0,
    contrast: 0,
    hue: 0,
    saturation: 0.6,
    toneMapping: {
      mode: ToneMappingMode.OPTIMIZED_CINEON,
      exposure: 0.7,
      whitePoint: 1.2,
    },
    vignette: {
      darkness: 0.9,
      offset: 0.35,
    },
    bloomIntensity: 0.25,
  },
  [GraphicsSettings.MID]: {
    brightness: 0,
    contrast: 0,
    hue: 0,
    saturation: 0.4,
    toneMapping: {
      mode: ToneMappingMode.OPTIMIZED_CINEON,
      exposure: 0.6,
      whitePoint: 1.1,
    },
    vignette: {
      darkness: 0.65,
      offset: 0.25,
    },
    bloomIntensity: 0.15,
  },
  [GraphicsSettings.LOW]: null,
};

export const CAMERA_FAR_PLANE = IS_FLAT_MODE ? CAMERA_CONFIG.far.flat : CAMERA_CONFIG.far.default;
