import { describe, expect, it } from "vitest";
import { resolveRendererPresentationQualityFeatures } from "./renderer-transient-performance-mode";
import type { QualityFeatures } from "./utils/quality-controller";

function createQualityFeatures(overrides: Partial<QualityFeatures> = {}): QualityFeatures {
  return {
    animationCullDistance: 120,
    animationFPS: 20,
    bloom: true,
    bloomIntensity: 0.25,
    chromaticAberration: true,
    chunkLoadRadius: 3,
    fxaa: true,
    labelRenderDistance: 120,
    maxVisibleArmies: 250,
    maxVisibleLabels: 200,
    maxVisibleStructures: 150,
    morphAnimations: true,
    pixelRatio: 2,
    shadowMapSize: 1024,
    shadows: true,
    vignette: true,
    ...overrides,
  };
}

describe("resolveRendererPresentationQualityFeatures", () => {
  it("preserves base quality when transient performance mode is inactive", () => {
    const features = createQualityFeatures();

    expect(
      resolveRendererPresentationQualityFeatures({
        baseFeatures: features,
        transientPerformanceModeActive: false,
      }),
    ).toBe(features);
  });

  it("reduces only renderer presentation features during transient performance mode", () => {
    const features = createQualityFeatures();

    const resolved = resolveRendererPresentationQualityFeatures({
      baseFeatures: features,
      transientPerformanceModeActive: true,
    });

    expect(resolved).toEqual({
      ...features,
      bloom: false,
      bloomIntensity: 0,
      chromaticAberration: false,
      fxaa: false,
      pixelRatio: 1.25,
      vignette: false,
    });
    expect(resolved.chunkLoadRadius).toBe(features.chunkLoadRadius);
    expect(resolved.maxVisibleArmies).toBe(features.maxVisibleArmies);
    expect(resolved.maxVisibleStructures).toBe(features.maxVisibleStructures);
  });
});
