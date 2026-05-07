import type { RendererActiveMode } from "./renderer-backend-v2";
import type { QualityFeatures } from "./utils/quality-controller";

const TRANSIENT_RENDER_PIXEL_RATIO_CAP = 1.25;

export function resolveRendererPresentationQualityFeatures(input: {
  activeMode?: RendererActiveMode | null;
  baseFeatures: QualityFeatures;
  transientPerformanceModeActive: boolean;
}): QualityFeatures {
  if (!input.transientPerformanceModeActive) {
    return input.baseFeatures;
  }

  return resolveTransientRenderPerformanceFeatures({
    activeMode: input.activeMode,
    baseFeatures: input.baseFeatures,
  });
}

function resolveTransientRenderPerformanceFeatures(input: {
  activeMode?: RendererActiveMode | null;
  baseFeatures: QualityFeatures;
}): QualityFeatures {
  return {
    ...input.baseFeatures,
    bloom: false,
    bloomIntensity: 0,
    chromaticAberration: false,
    fxaa: false,
    pixelRatio: resolveTransientRenderPixelRatio(input),
    vignette: false,
  };
}

function resolveTransientRenderPixelRatio(input: {
  activeMode?: RendererActiveMode | null;
  baseFeatures: QualityFeatures;
}): number {
  if (input.activeMode === "webgpu") {
    return input.baseFeatures.pixelRatio;
  }

  return Math.min(input.baseFeatures.pixelRatio, TRANSIENT_RENDER_PIXEL_RATIO_CAP);
}
