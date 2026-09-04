import type {
  RendererActiveMode,
  RendererBackendCapabilities,
  RendererCapabilityFeature,
  RendererFeatureDegradation,
  RendererInitDiagnostics,
  RendererPostProcessPlan,
} from "./renderer-backend-v2";
import type { WebgpuPostprocessPolicy } from "./webgpu-postprocess-policy";
import {
  markRendererGpuDeviceLost,
  markRendererGpuDeviceReady,
  recordRendererGpuUncapturedError,
  recordRendererInitTelemetry,
  resetRendererGpuTelemetry,
  snapshotRendererGpuTelemetry,
} from "./perf/renderer-gpu-telemetry";
import {
  resetRendererStartupTimings,
  snapshotRendererStartupTimings,
  type RendererStartupTimingsSnapshot,
} from "./perf/renderer-startup-telemetry";

interface RendererDiagnosticsSnapshot {
  activeMode: RendererInitDiagnostics["activeMode"] | null;
  adapterInfo: RendererInitDiagnostics["adapterInfo"] | null;
  buildMode: RendererInitDiagnostics["buildMode"] | null;
  capabilities: RendererBackendCapabilities | null;
  degradations: RendererFeatureDegradation[];
  effectPlan: RendererPostProcessPlan | null;
  fallbackReason: string | null;
  fallbacks: number;
  gpuTelemetry: ReturnType<typeof snapshotRendererGpuTelemetry>;
  initErrors: number;
  initTimeMs: number | null;
  postprocessPolicy: WebgpuPostprocessPolicy | null;
  requestedMode: RendererInitDiagnostics["requestedMode"] | null;
  sceneName: string | null;
  startupTimings: RendererStartupTimingsSnapshot;
}

interface RendererDiagnosticsWindow {
  __rendererDiagnostics?: RendererDiagnosticsSnapshot;
}

const createRendererDiagnosticsState = (): RendererDiagnosticsSnapshot => ({
  activeMode: null,
  adapterInfo: null,
  buildMode: null,
  capabilities: null,
  degradations: [],
  effectPlan: null,
  fallbackReason: null,
  fallbacks: 0,
  gpuTelemetry: snapshotRendererGpuTelemetry(),
  initErrors: 0,
  initTimeMs: null,
  postprocessPolicy: null,
  requestedMode: null,
  sceneName: null,
  startupTimings: snapshotRendererStartupTimings(),
});

let rendererDiagnosticsState = createRendererDiagnosticsState();

function syncRendererDiagnosticsWindow(): void {
  if (typeof window === "undefined") {
    return;
  }

  (window as typeof window & RendererDiagnosticsWindow).__rendererDiagnostics = snapshotRendererDiagnostics();
}

export function syncRendererBackendDiagnostics(input: RendererInitDiagnostics): void {
  recordRendererInitTelemetry({
    activeMode: input.activeMode,
    initTimeMs: input.initTimeMs,
  });
  if (input.deviceStatus === "ready") {
    markRendererGpuDeviceReady();
  }
  rendererDiagnosticsState = {
    ...rendererDiagnosticsState,
    activeMode: input.activeMode,
    adapterInfo: input.adapterInfo ? { ...input.adapterInfo } : null,
    buildMode: input.buildMode,
    fallbackReason: input.fallbackReason,
    initTimeMs: input.initTimeMs,
    gpuTelemetry: snapshotRendererGpuTelemetry(),
    requestedMode: input.requestedMode,
    startupTimings: snapshotRendererStartupTimings(),
  };
  syncRendererDiagnosticsWindow();
}

export function markRendererDiagnosticDeviceLost(message?: string): void {
  markRendererGpuDeviceLost(message);
  rendererDiagnosticsState = {
    ...rendererDiagnosticsState,
    activeMode: rendererDiagnosticsState.activeMode === "webgpu" ? null : rendererDiagnosticsState.activeMode,
    fallbackReason:
      rendererDiagnosticsState.activeMode === "webgpu" ? "webgpu-device-lost" : rendererDiagnosticsState.fallbackReason,
    gpuTelemetry: snapshotRendererGpuTelemetry(),
    startupTimings: snapshotRendererStartupTimings(),
  };
  syncRendererDiagnosticsWindow();
}

export function recordRendererDiagnosticUncapturedError(message?: string): void {
  recordRendererGpuUncapturedError(message);
  rendererDiagnosticsState = {
    ...rendererDiagnosticsState,
    gpuTelemetry: snapshotRendererGpuTelemetry(),
    startupTimings: snapshotRendererStartupTimings(),
  };
  syncRendererDiagnosticsWindow();
}

export function setRendererDiagnosticCapabilities(capabilities: RendererBackendCapabilities): void {
  rendererDiagnosticsState = {
    ...rendererDiagnosticsState,
    capabilities: { ...capabilities },
  };
  syncRendererDiagnosticsWindow();
}

export function setRendererDiagnosticDegradations(degradations: RendererFeatureDegradation[]): void {
  rendererDiagnosticsState = {
    ...rendererDiagnosticsState,
    degradations: degradations.map((degradation) => ({ ...degradation })),
  };
  syncRendererDiagnosticsWindow();
}

export function replaceRendererDiagnosticDegradations(
  features: RendererCapabilityFeature[],
  degradations: RendererFeatureDegradation[],
): void {
  const featureSet = new Set(features);
  rendererDiagnosticsState.degradations = [
    ...rendererDiagnosticsState.degradations.filter((degradation) => !featureSet.has(degradation.feature)),
    ...degradations.map((degradation) => ({ ...degradation })),
  ];
  syncRendererDiagnosticsWindow();
}

export function setRendererDiagnosticEffectPlan(effectPlan: RendererPostProcessPlan): void {
  rendererDiagnosticsState.effectPlan = {
    antiAlias: effectPlan.antiAlias,
    bloom: { ...effectPlan.bloom },
    chromaticAberration: { ...effectPlan.chromaticAberration },
    colorGrade: { ...effectPlan.colorGrade },
    toneMapping: { ...effectPlan.toneMapping },
    vignette: { ...effectPlan.vignette },
  };
  syncRendererDiagnosticsWindow();
}

export function setRendererDiagnosticPostprocessPolicy(policy: WebgpuPostprocessPolicy): void {
  rendererDiagnosticsState.postprocessPolicy = {
    bloomRouting: policy.bloomRouting,
    mode: policy.mode,
    unsupportedFeatures: [...policy.unsupportedFeatures],
  };
  syncRendererDiagnosticsWindow();
}

export function setRendererDiagnosticSceneName(sceneName: string): void {
  // Phase 3.6: called every rendered frame; skip the deep window snapshot unless the
  // scene name actually changed (other diagnostics re-mirror via their own setters).
  if (rendererDiagnosticsState.sceneName === sceneName) {
    return;
  }
  rendererDiagnosticsState.sceneName = sceneName;
  syncRendererDiagnosticsWindow();
}

export function incrementRendererDiagnosticError(type: "fallbacks" | "initErrors", amount: number = 1): void {
  rendererDiagnosticsState[type] += Math.max(0, Math.floor(amount));
  syncRendererDiagnosticsWindow();
}

export function snapshotRendererDiagnostics(): RendererDiagnosticsSnapshot {
  return {
    ...rendererDiagnosticsState,
    adapterInfo: rendererDiagnosticsState.adapterInfo ? { ...rendererDiagnosticsState.adapterInfo } : null,
    capabilities: rendererDiagnosticsState.capabilities ? { ...rendererDiagnosticsState.capabilities } : null,
    degradations: rendererDiagnosticsState.degradations.map((degradation) => ({ ...degradation })),
    effectPlan: rendererDiagnosticsState.effectPlan
      ? {
          antiAlias: rendererDiagnosticsState.effectPlan.antiAlias,
          bloom: { ...rendererDiagnosticsState.effectPlan.bloom },
          chromaticAberration: { ...rendererDiagnosticsState.effectPlan.chromaticAberration },
          colorGrade: { ...rendererDiagnosticsState.effectPlan.colorGrade },
          toneMapping: { ...rendererDiagnosticsState.effectPlan.toneMapping },
          vignette: { ...rendererDiagnosticsState.effectPlan.vignette },
        }
      : null,
    gpuTelemetry: snapshotRendererGpuTelemetry(),
    startupTimings: snapshotRendererStartupTimings(),
    postprocessPolicy: rendererDiagnosticsState.postprocessPolicy
      ? {
          bloomRouting: rendererDiagnosticsState.postprocessPolicy.bloomRouting,
          mode: rendererDiagnosticsState.postprocessPolicy.mode,
          unsupportedFeatures: [...rendererDiagnosticsState.postprocessPolicy.unsupportedFeatures],
        }
      : null,
  };
}

export function getRendererDiagnosticActiveMode(): RendererActiveMode | null {
  return rendererDiagnosticsState.activeMode;
}

export function resetRendererDiagnostics(): void {
  resetRendererGpuTelemetry();
  resetRendererStartupTimings();
  rendererDiagnosticsState = createRendererDiagnosticsState();
  syncRendererDiagnosticsWindow();
}
