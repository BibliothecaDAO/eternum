import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  incrementRendererDiagnosticError,
  resetRendererDiagnostics,
  setRendererDiagnosticCapabilities,
  setRendererDiagnosticDegradations,
  setRendererDiagnosticEffectPlan,
  setRendererDiagnosticPostprocessPolicy,
  setRendererDiagnosticSceneName,
  snapshotRendererDiagnostics,
  syncRendererBackendDiagnostics,
} from "./renderer-diagnostics";

describe("renderer-diagnostics", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
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
    setRendererDiagnosticCapabilities({
      supportsBloom: false,
      supportsChromaticAberration: false,
      supportsColorGrade: false,
      supportsEnvironmentIbl: false,
      supportsToneMappingControl: true,
      supportsVignette: false,
      supportsWideLines: false,
    });
    setRendererDiagnosticDegradations([
      {
        detail: "webgpu backend does not own PMREM-based environment yet",
        feature: "environmentIbl",
        reason: "unsupported-backend",
      },
      {
        feature: "bloom",
        reason: "disabled-by-quality",
      },
    ]);
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
    setRendererDiagnosticPostprocessPolicy({
      bloomRouting: "deferred",
      mode: "native-webgpu-minimal",
      prewarmStrategy: "compile-async",
      unsupportedFeatures: ["environmentIbl", "toneMappingControl"],
    });
    setRendererDiagnosticSceneName("worldmap");
    incrementRendererDiagnosticError("fallbacks");
    incrementRendererDiagnosticError("initErrors", 2);

    expect(snapshotRendererDiagnostics()).toEqual({
      activeMode: "webgl2-fallback",
      buildMode: "experimental-webgpu-auto",
      capabilities: {
        supportsBloom: false,
        supportsChromaticAberration: false,
        supportsColorGrade: false,
        supportsEnvironmentIbl: false,
        supportsToneMappingControl: true,
        supportsVignette: false,
        supportsWideLines: false,
      },
      degradations: [
        {
          detail: "webgpu backend does not own PMREM-based environment yet",
          feature: "environmentIbl",
          reason: "unsupported-backend",
        },
        {
          feature: "bloom",
          reason: "disabled-by-quality",
        },
      ],
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
      gpuTelemetry: {
        activeMode: "webgl2-fallback",
        deviceLossMessage: null,
        deviceStatus: "unknown",
        gpuFrameTimeMs: null,
        initTimeMs: 42,
        lastUncapturedErrorMessage: null,
        lastUploadLabel: null,
        totalUploadBytes: 0,
        uncapturedErrorCount: 0,
        uploadBytesByLabel: {},
      },
      initErrors: 2,
      initTimeMs: 42,
      fallbacks: 1,
      postprocessPolicy: {
        bloomRouting: "deferred",
        mode: "native-webgpu-minimal",
        prewarmStrategy: "compile-async",
        unsupportedFeatures: ["environmentIbl", "toneMappingControl"],
      },
      requestedMode: "experimental-webgpu-auto",
      sceneName: "worldmap",
    });
  });

  it("mirrors the latest diagnostics snapshot onto the debug window", () => {
    syncRendererBackendDiagnostics({
      activeMode: "legacy-webgl",
      buildMode: "experimental-webgpu-force-webgl",
      fallbackReason: "manual-kill-switch",
      initTimeMs: 12,
      requestedMode: "legacy-webgl",
    });
    setRendererDiagnosticCapabilities({
      supportsBloom: true,
      supportsChromaticAberration: true,
      supportsColorGrade: true,
      supportsEnvironmentIbl: true,
      supportsToneMappingControl: true,
      supportsVignette: true,
      supportsWideLines: false,
    });

    expect((window as { __rendererDiagnostics?: unknown }).__rendererDiagnostics).toEqual({
      activeMode: "legacy-webgl",
      buildMode: "experimental-webgpu-force-webgl",
      capabilities: {
        supportsBloom: true,
        supportsChromaticAberration: true,
        supportsColorGrade: true,
        supportsEnvironmentIbl: true,
        supportsToneMappingControl: true,
        supportsVignette: true,
        supportsWideLines: false,
      },
      degradations: [],
      effectPlan: null,
      fallbackReason: "manual-kill-switch",
      fallbacks: 0,
      gpuTelemetry: {
        activeMode: "legacy-webgl",
        deviceLossMessage: null,
        deviceStatus: "unknown",
        gpuFrameTimeMs: null,
        initTimeMs: 12,
        lastUncapturedErrorMessage: null,
        lastUploadLabel: null,
        totalUploadBytes: 0,
        uncapturedErrorCount: 0,
        uploadBytesByLabel: {},
      },
      initErrors: 0,
      initTimeMs: 12,
      postprocessPolicy: null,
      requestedMode: "legacy-webgl",
      sceneName: null,
    });
  });

  it("setRendererDiagnosticCapabilities produces a new state object reference", () => {
    const before = snapshotRendererDiagnostics();
    setRendererDiagnosticCapabilities({
      supportsBloom: true,
      supportsChromaticAberration: false,
      supportsColorGrade: false,
      supportsEnvironmentIbl: false,
      supportsToneMappingControl: false,
      supportsVignette: false,
      supportsWideLines: false,
    });
    const after = snapshotRendererDiagnostics();
    expect(after).not.toBe(before);
    expect(after.capabilities).toEqual({
      supportsBloom: true,
      supportsChromaticAberration: false,
      supportsColorGrade: false,
      supportsEnvironmentIbl: false,
      supportsToneMappingControl: false,
      supportsVignette: false,
      supportsWideLines: false,
    });
  });

  it("setRendererDiagnosticDegradations produces a new state object reference", () => {
    const before = snapshotRendererDiagnostics();
    setRendererDiagnosticDegradations([{ feature: "bloom", reason: "disabled-by-quality" }]);
    const after = snapshotRendererDiagnostics();
    expect(after).not.toBe(before);
    expect(after.degradations).toEqual([{ feature: "bloom", reason: "disabled-by-quality" }]);
  });
});
