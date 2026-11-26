import { readGraphicsPreferences, type GraphicsQuality } from "./graphics-preferences";

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

type QualityProfile = { maxFps: number | null; visuals: Omit<RenderVisualProfile, "shadows"> };

const ANIMATION = { animationCullDistance: 120, animationFps: 24 };

const QUALITY_PROFILES: Readonly<Record<GraphicsQuality, QualityProfile>> = {
  low: { maxFps: 30, visuals: { ...ANIMATION, pixelRatio: 1, postProcessing: false, shadowMapSize: 512 } },
  balanced: { maxFps: null, visuals: { ...ANIMATION, pixelRatio: 1, postProcessing: true, shadowMapSize: 512 } },
  high: { maxFps: null, visuals: { ...ANIMATION, pixelRatio: 1.25, postProcessing: true, shadowMapSize: 1024 } },
};

export function createRenderProfile(quality: GraphicsQuality, shadows: boolean): RenderProfile {
  const { maxFps, visuals } = QUALITY_PROFILES[quality];
  return { maxFps, visuals: { ...visuals, shadows } };
}

const browserStorage = typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;

export const loadedGraphicsPreferences = readGraphicsPreferences(browserStorage);

export const renderProfile = createRenderProfile(loadedGraphicsPreferences.quality, loadedGraphicsPreferences.shadows);
