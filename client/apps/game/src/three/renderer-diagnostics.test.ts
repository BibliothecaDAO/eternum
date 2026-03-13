import { beforeEach, describe, expect, it } from "vitest";
import {
  incrementRendererDiagnosticError,
  resetRendererDiagnostics,
  setRendererDiagnosticEffectPlan,
  setRendererDiagnosticSceneName,
  snapshotRendererDiagnostics,
  syncRendererBackendDiagnostics,
} from "./renderer-diagnostics";

describe("renderer-diagnostics", () => {
  beforeEach(() => {
    resetRendererDiagnostics();
  });

  it("tracks backend mode, fallback reason, effect plan, scene name, and error counters", () => {
    syncRendererBackendDiagnostics({
      activeMode: "webgl2-fallback",
      buildMode: "experimental-webgpu-auto",
      fallbackReason: "experimental-init-error",
      initTimeMs: 42,
      requestedMode: "experimental-webgpu-auto",
    });
    setRendererDiagnosticEffectPlan({
      antiAlias: "fxaa",
      bloom: { enabled: true, intensity: 0.35 },
      chromaticAberration: { enabled: false },
      colorGrade: {
        brightness: 0,
        contrast: 0.1,
        hue: 0,
        saturation: 0.2,
      },
      toneMapping: {
        exposure: 0.7,
        mode: "cineon",
        whitePoint: 1.1,
      },
      vignette: {
        darkness: 0.6,
        enabled: true,
        offset: 0.25,
      },
    });
    setRendererDiagnosticSceneName("worldmap");
    incrementRendererDiagnosticError("fallbacks");
    incrementRendererDiagnosticError("initErrors", 2);

    expect(snapshotRendererDiagnostics()).toEqual({
      activeMode: "webgl2-fallback",
      buildMode: "experimental-webgpu-auto",
      effectPlan: {
        antiAlias: "fxaa",
        bloom: { enabled: true, intensity: 0.35 },
        chromaticAberration: { enabled: false },
        colorGrade: {
          brightness: 0,
          contrast: 0.1,
          hue: 0,
          saturation: 0.2,
        },
        toneMapping: {
          exposure: 0.7,
          mode: "cineon",
          whitePoint: 1.1,
        },
        vignette: {
          darkness: 0.6,
          enabled: true,
          offset: 0.25,
        },
      },
      fallbackReason: "experimental-init-error",
      initErrors: 2,
      initTimeMs: 42,
      fallbacks: 1,
      requestedMode: "experimental-webgpu-auto",
      sceneName: "worldmap",
    });
  });
});
