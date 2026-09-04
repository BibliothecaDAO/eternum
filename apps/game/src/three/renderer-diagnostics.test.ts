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
      buildMode: "webgpu-auto",
      fallbackReason: "webgpu-device-lost",
      initTimeMs: 42,
      requestedMode: "webgpu-auto",
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
        reason: "disabled-by-profile",
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
      unsupportedFeatures: ["environmentIbl", "toneMappingControl"],
    });
    setRendererDiagnosticSceneName("worldmap");
    incrementRendererDiagnosticError("fallbacks");
    incrementRendererDiagnosticError("initErrors", 2);

    expect(snapshotRendererDiagnostics()).toEqual({
      activeMode: "webgl2-fallback",
      adapterInfo: null,
      buildMode: "webgpu-auto",
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
          reason: "disabled-by-profile",
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
      fallbackReason: "webgpu-device-lost",
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
        unsupportedFeatures: ["environmentIbl", "toneMappingControl"],
      },
      requestedMode: "webgpu-auto",
      sceneName: "worldmap",
      startupTimings: {},
    });
  });

  it("mirrors the latest diagnostics snapshot onto the debug window", () => {
    syncRendererBackendDiagnostics({
      activeMode: "webgl2-fallback",
      buildMode: "webgpu-force-webgl",
      fallbackReason: "webgpu-device-lost",
      initTimeMs: 12,
      requestedMode: "webgpu-force-webgl",
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
      activeMode: "webgl2-fallback",
      adapterInfo: null,
      buildMode: "webgpu-force-webgl",
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
      fallbackReason: "webgpu-device-lost",
      fallbacks: 0,
      gpuTelemetry: {
        activeMode: "webgl2-fallback",
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
      requestedMode: "webgpu-force-webgl",
      sceneName: null,
      startupTimings: {},
    });
  });

  it("publishes device readiness atomically with initialized WebGPU diagnostics", () => {
    syncRendererBackendDiagnostics({
      activeMode: "webgpu",
      buildMode: "webgpu-auto",
      deviceStatus: "ready",
      fallbackReason: null,
      initTimeMs: 12,
      requestedMode: "webgpu-auto",
    });

    expect(snapshotRendererDiagnostics().gpuTelemetry).toMatchObject({
      activeMode: "webgpu",
      deviceStatus: "ready",
      initTimeMs: 12,
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
    setRendererDiagnosticDegradations([{ feature: "bloom", reason: "disabled-by-profile" }]);
    const after = snapshotRendererDiagnostics();
    expect(after).not.toBe(before);
    expect(after.degradations).toEqual([{ feature: "bloom", reason: "disabled-by-profile" }]);
  });

  // Phase 3.6: setRendererDiagnosticSceneName runs every rendered frame, but the
  // scene name almost never changes. Skip the deep window snapshot when it is
  // unchanged instead of re-mirroring ~1000 times/second.
  it("does not re-mirror the window diagnostics when the scene name is unchanged", () => {
    setRendererDiagnosticSceneName("worldmap");
    const firstMirror = (window as { __rendererDiagnostics?: unknown }).__rendererDiagnostics;
    setRendererDiagnosticSceneName("worldmap");
    expect((window as { __rendererDiagnostics?: unknown }).__rendererDiagnostics).toBe(firstMirror);
  });

  it("re-mirrors the window diagnostics when the scene name changes", () => {
    setRendererDiagnosticSceneName("worldmap");
    const firstMirror = (window as { __rendererDiagnostics?: unknown }).__rendererDiagnostics;
    setRendererDiagnosticSceneName("hexception");
    const secondMirror = (window as { __rendererDiagnostics?: { sceneName?: string } }).__rendererDiagnostics;
    expect(secondMirror).not.toBe(firstMirror);
    expect(secondMirror?.sceneName).toBe("hexception");
  });
});
