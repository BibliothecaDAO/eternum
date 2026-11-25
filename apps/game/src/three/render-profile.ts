import { readGraphicsQuality, type GraphicsQuality } from "./graphics-preferences";

export interface RenderVisualProfile {
  animationCullDistance: number;
  animationFps: number;
  pixelRatio: number;
  postProcessing: boolean;
  shadowMapSize: number;
  shadows: boolean;
}

interface RenderProfile {
  maxFps: number | null;
  visuals: RenderVisualProfile;
}

const ANIMATION = { animationCullDistance: 120, animationFps: 24 };

export const RENDER_PROFILES: Readonly<Record<GraphicsQuality, RenderProfile>> = {
  low: {
    maxFps: 30,
    visuals: { ...ANIMATION, pixelRatio: 1, postProcessing: false, shadowMapSize: 512, shadows: false },
  },
  balanced: {
    maxFps: null,
    visuals: { ...ANIMATION, pixelRatio: 1.25, postProcessing: true, shadowMapSize: 1024, shadows: true },
  },
  high: {
    maxFps: null,
    visuals: { ...ANIMATION, pixelRatio: 2, postProcessing: true, shadowMapSize: 2048, shadows: true },
  },
};

const browserStorage = typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;

export const loadedGraphicsQuality = readGraphicsQuality(browserStorage);

export const renderProfile = RENDER_PROFILES[loadedGraphicsQuality];
