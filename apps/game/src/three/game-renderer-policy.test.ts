import { describe, expect, it } from "vitest";
import {
  resolveRendererEnvironmentPolicy,
  resolveLabelRenderDecision,
  resolveLabelRenderIntervalMs,
} from "./game-renderer-policy";
import { createRendererBackendCapabilities } from "./renderer-backend";

describe("resolveLabelRenderIntervalMs", () => {
  it("floors the close-view cadence at one frame on desktop", () => {
    expect(resolveLabelRenderIntervalMs("close", false)).toBe(16);
  });

  it("scales the close-view floor on mobile", () => {
    expect(resolveLabelRenderIntervalMs("close", true)).toBe(24);
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

describe("resolveRendererEnvironmentPolicy", () => {
  it("applies environment IBL with the requested intensity when the backend supports it", () => {
    expect(
      resolveRendererEnvironmentPolicy({
        capabilities: createRendererBackendCapabilities({
          supportsEnvironmentIbl: true,
        }),
        intensity: 0.55,
      }),
    ).toEqual({
      degradations: [],
      intensity: 0.55,
      shouldApplyEnvironment: true,
    });
  });

  it("reports an explicit fallback lighting degradation when environment IBL is unavailable", () => {
    expect(
      resolveRendererEnvironmentPolicy({
        capabilities: createRendererBackendCapabilities(),
        intensity: 0.45,
      }),
    ).toEqual({
      degradations: [
        {
          detail: "Using scene key/fill fallback lighting policy at target environment intensity 0.45",
          feature: "environmentIbl",
          reason: "unsupported-backend",
        },
      ],
      intensity: 0.45,
      shouldApplyEnvironment: false,
    });
  });
});
