import type { QualityFeatures } from "./utils/quality-controller";

const TRANSIENT_RENDER_PIXEL_RATIO_CAP = 1.25;

export function resolveRendererPresentationQualityFeatures(input: {
  baseFeatures: QualityFeatures;
  transientPerformanceModeActive: boolean;
}): QualityFeatures {
  if (!input.transientPerformanceModeActive) {
    return input.baseFeatures;
  }

  return resolveTransientRenderPerformanceFeatures(input.baseFeatures);
}

function resolveTransientRenderPerformanceFeatures(baseFeatures: QualityFeatures): QualityFeatures {
  return {
    ...baseFeatures,
    bloom: false,
    bloomIntensity: 0,
    chromaticAberration: false,
    fxaa: false,
    pixelRatio: Math.min(baseFeatures.pixelRatio, TRANSIENT_RENDER_PIXEL_RATIO_CAP),
    vignette: false,
  };
}
