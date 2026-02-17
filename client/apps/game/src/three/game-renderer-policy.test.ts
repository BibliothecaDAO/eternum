import { describe, expect, it } from "vitest";
import {
  resolveLabelRenderDecision,
  resolveLabelRenderIntervalMs,
  resolvePostProcessingEffectPlan,
  shouldEnablePostProcessingConfig,
} from "./game-renderer-policy";

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
        vignette: false,
      }),
    ).toEqual({
      shouldEnableFXAA: true,
      shouldEnableBloom: false,
      shouldEnableVignette: false,
      shouldEnableChromaticAberration: false,
    });
  });

  it("enables chromatic aberration only when vignette is enabled", () => {
    expect(
      resolvePostProcessingEffectPlan({
        fxaa: false,
        bloom: true,
        vignette: true,
      }),
    ).toEqual({
      shouldEnableFXAA: false,
      shouldEnableBloom: true,
      shouldEnableVignette: true,
      shouldEnableChromaticAberration: true,
    });
  });
});
