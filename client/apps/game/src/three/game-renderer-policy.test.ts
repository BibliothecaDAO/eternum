import { describe, expect, it } from "vitest";
import {
  resolveCapabilityAwareRendererEffectPlan,
  resolveLabelRenderDecision,
  resolveLabelRenderIntervalMs,
  resolveRendererEffectPlan,
  resolvePostProcessingEffectPlan,
  shouldEnablePostProcessingConfig,
} from "./game-renderer-policy";
import { createRendererBackendCapabilities } from "./renderer-backend-v2";

describe("resolveLabelRenderIntervalMs", () => {
  it("returns close-view cadence for desktop", () => {
    expect(resolveLabelRenderIntervalMs("close", false)).toBe(0);
  });

  it("applies mobile floor cadence for close view", () => {
    expect(resolveLabelRenderIntervalMs("close", true)).toBe(33);
  });

  it("scales medium cadence on mobile", () => {
    expect(resolveLabelRenderIntervalMs("medium", true)).toBe(50);
  });

  it("returns far-view cadence for desktop", () => {
    expect(resolveLabelRenderIntervalMs("far", false)).toBe(100);
  });
});

describe("resolveLabelRenderDecision", () => {
  it("renders immediately when labels are dirty", () => {
    expect(
      resolveLabelRenderDecision({
        now: 200,
        lastLabelRenderTime: 120,
        labelsDirty: true,
        lastLabelsActive: false,
        labelsActive: false,
        intervalMs: 33,
      }),
    ).toEqual({
      shouldRender: true,
      nextLabelsDirty: false,
      nextLastLabelsActive: false,
      nextLastLabelRenderTime: 200,
    });
  });

  it("marks labels dirty when active state changes and renders", () => {
    expect(
      resolveLabelRenderDecision({
        now: 350,
        lastLabelRenderTime: 340,
        labelsDirty: false,
        lastLabelsActive: false,
        labelsActive: true,
        intervalMs: 100,
      }),
    ).toEqual({
      shouldRender: true,
      nextLabelsDirty: false,
      nextLastLabelsActive: true,
      nextLastLabelRenderTime: 350,
    });
  });

  it("renders on cadence when labels are active", () => {
    expect(
      resolveLabelRenderDecision({
        now: 1000,
        lastLabelRenderTime: 890,
        labelsDirty: false,
        lastLabelsActive: true,
        labelsActive: true,
        intervalMs: 100,
      }),
    ).toEqual({
      shouldRender: true,
      nextLabelsDirty: false,
      nextLastLabelsActive: true,
      nextLastLabelRenderTime: 1000,
    });
  });

  it("skips render when labels are stable and cadence not reached", () => {
    expect(
      resolveLabelRenderDecision({
        now: 930,
        lastLabelRenderTime: 890,
        labelsDirty: false,
        lastLabelsActive: true,
        labelsActive: true,
        intervalMs: 100,
      }),
    ).toEqual({
      shouldRender: false,
      nextLabelsDirty: false,
      nextLastLabelsActive: true,
      nextLastLabelRenderTime: 890,
    });
  });
});

describe("shouldEnablePostProcessingConfig", () => {
  it("disables post-processing when no config exists", () => {
    expect(
      shouldEnablePostProcessingConfig({
        hasPostProcessingConfig: false,
        isMobileDevice: false,
        isHighGraphicsSetting: true,
      }),
    ).toBe(false);
  });

  it("disables post-processing on mobile when graphics setting is not high", () => {
    expect(
      shouldEnablePostProcessingConfig({
        hasPostProcessingConfig: true,
        isMobileDevice: true,
        isHighGraphicsSetting: false,
      }),
    ).toBe(false);
  });

  it("enables post-processing on mobile high setting", () => {
    expect(
      shouldEnablePostProcessingConfig({
        hasPostProcessingConfig: true,
        isMobileDevice: true,
        isHighGraphicsSetting: true,
      }),
    ).toBe(true);
  });
});

describe("resolvePostProcessingEffectPlan", () => {
  it("enables only selected quality effects", () => {
    expect(
      resolvePostProcessingEffectPlan({
        fxaa: true,
        bloom: false,
        chromaticAberration: false,
        vignette: false,
      }),
    ).toEqual({
      shouldEnableFXAA: true,
      shouldEnableBloom: false,
      shouldEnableVignette: false,
      shouldEnableChromaticAberration: false,
    });
  });

  it("keeps chromatic aberration tied to its own quality toggle", () => {
    expect(
      resolvePostProcessingEffectPlan({
        fxaa: false,
        bloom: true,
        chromaticAberration: true,
        vignette: false,
      }),
    ).toEqual({
      shouldEnableFXAA: false,
      shouldEnableBloom: true,
      shouldEnableVignette: false,
      shouldEnableChromaticAberration: true,
    });
  });
});

describe("resolveRendererEffectPlan", () => {
  it("maps quality toggles into a backend-neutral effect policy", () => {
    expect(
      resolveRendererEffectPlan({
        antiAlias: "fxaa",
        bloomEnabled: true,
        bloomIntensity: 0.35,
        chromaticAberrationEnabled: false,
        colorGrade: {
          brightness: 0.92,
          contrast: 1.08,
          hue: 0.01,
          saturation: 0.88,
        },
        toneMapping: {
          exposure: 1.15,
          mode: "aces-filmic",
          whitePoint: 4.5,
        },
        vignette: {
          darkness: 0.4,
          enabled: false,
          offset: 0.2,
        },
      }),
    ).toEqual({
      antiAlias: "fxaa",
      bloom: {
        enabled: true,
        intensity: 0.35,
      },
      chromaticAberration: {
        enabled: false,
      },
      colorGrade: {
        brightness: 0.92,
        contrast: 1.08,
        hue: 0.01,
        saturation: 0.88,
      },
      toneMapping: {
        exposure: 1.15,
        mode: "aces-filmic",
        whitePoint: 4.5,
      },
      vignette: {
        darkness: 0.4,
        enabled: false,
        offset: 0.2,
      },
    });
  });

  it("disables optional effects cleanly", () => {
    expect(
      resolveRendererEffectPlan({
        antiAlias: "none",
        bloomEnabled: false,
        bloomIntensity: 0.7,
        chromaticAberrationEnabled: true,
        colorGrade: {
          brightness: 1,
          contrast: 1,
          hue: 0,
          saturation: 1,
        },
        toneMapping: {
          exposure: 0.95,
          mode: "reinhard",
          whitePoint: 3,
        },
        vignette: {
          darkness: 0.65,
          enabled: true,
          offset: 0.35,
        },
      }),
    ).toEqual({
      antiAlias: "none",
      bloom: {
        enabled: false,
        intensity: 0.7,
      },
      chromaticAberration: {
        enabled: true,
      },
      colorGrade: {
        brightness: 1,
        contrast: 1,
        hue: 0,
        saturation: 1,
      },
      toneMapping: {
        exposure: 0.95,
        mode: "reinhard",
        whitePoint: 3,
      },
      vignette: {
        darkness: 0.65,
        enabled: true,
        offset: 0.35,
      },
    });
  });
});

describe("resolveCapabilityAwareRendererEffectPlan", () => {
  it("turns unsupported optional effects into explicit degradations instead of active flags", () => {
    expect(
      resolveCapabilityAwareRendererEffectPlan({
        antiAlias: "fxaa",
        bloomEnabled: true,
        bloomIntensity: 0.35,
        capabilities: createRendererBackendCapabilities({
          supportsToneMappingControl: true,
        }),
        chromaticAberrationEnabled: true,
        colorGrade: {
          brightness: 0,
          contrast: 0.1,
          hue: 0,
          saturation: 0.2,
        },
        disabledReasons: {},
        toneMapping: {
          exposure: 1.15,
          mode: "aces-filmic",
          whitePoint: 4.5,
        },
        vignette: {
          darkness: 0.4,
          enabled: true,
          offset: 0.2,
        },
      }),
    ).toEqual({
      degradations: [
        { feature: "colorGrade", reason: "unsupported-backend" },
        { feature: "bloom", reason: "unsupported-backend" },
        { feature: "vignette", reason: "unsupported-backend" },
        { feature: "chromaticAberration", reason: "unsupported-backend" },
      ],
      plan: {
        antiAlias: "fxaa",
        bloom: {
          enabled: false,
          intensity: 0.35,
        },
        chromaticAberration: {
          enabled: false,
        },
        colorGrade: {
          brightness: 0,
          contrast: 0,
          hue: 0,
          saturation: 0,
        },
        toneMapping: {
          exposure: 1.15,
          mode: "aces-filmic",
          whitePoint: 4.5,
        },
        vignette: {
          darkness: 0.4,
          enabled: false,
          offset: 0.2,
        },
      },
    });
  });

  it("records when optional effects were disabled by policy rather than by backend support", () => {
    expect(
      resolveCapabilityAwareRendererEffectPlan({
        antiAlias: "none",
        bloomEnabled: false,
        bloomIntensity: 0.25,
        capabilities: createRendererBackendCapabilities({
          supportsBloom: true,
          supportsChromaticAberration: true,
          supportsToneMappingControl: true,
          supportsVignette: true,
        }),
        chromaticAberrationEnabled: false,
        colorGrade: {
          brightness: 0,
          contrast: 0,
          hue: 0,
          saturation: 0,
        },
        disabledReasons: {
          bloom: "disabled-by-quality",
          chromaticAberration: "disabled-by-user",
        },
        toneMapping: {
          exposure: 1,
          mode: "linear",
          whitePoint: 1,
        },
        vignette: {
          darkness: 0,
          enabled: false,
          offset: 0,
        },
      }),
    ).toEqual({
      degradations: [
        { feature: "bloom", reason: "disabled-by-quality" },
        { feature: "chromaticAberration", reason: "disabled-by-user" },
      ],
      plan: {
        antiAlias: "none",
        bloom: {
          enabled: false,
          intensity: 0.25,
        },
        chromaticAberration: {
          enabled: false,
        },
        colorGrade: {
          brightness: 0,
          contrast: 0,
          hue: 0,
          saturation: 0,
        },
        toneMapping: {
          exposure: 1,
          mode: "linear",
          whitePoint: 1,
        },
        vignette: {
          darkness: 0,
          enabled: false,
          offset: 0,
        },
      },
    });
  });
});
