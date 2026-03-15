import type {
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

interface RendererDiagnosticsSnapshot {
  activeMode: RendererInitDiagnostics["activeMode"] | null;
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
}

interface RendererDiagnosticsWindow {
  __rendererDiagnostics?: RendererDiagnosticsSnapshot;
}

const createRendererDiagnosticsState = (): RendererDiagnosticsSnapshot => ({
  activeMode: null,
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
  rendererDiagnosticsState = {
    ...rendererDiagnosticsState,
    activeMode: input.activeMode,
    buildMode: input.buildMode,
    fallbackReason: input.fallbackReason,
    initTimeMs: input.initTimeMs,
    gpuTelemetry: snapshotRendererGpuTelemetry(),
    requestedMode: input.requestedMode,
  };
  syncRendererDiagnosticsWindow();
}

export function markRendererDiagnosticDeviceReady(): void {
  markRendererGpuDeviceReady();
  rendererDiagnosticsState = {
    ...rendererDiagnosticsState,
    gpuTelemetry: snapshotRendererGpuTelemetry(),
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
  };
  syncRendererDiagnosticsWindow();
}

export function recordRendererDiagnosticUncapturedError(message?: string): void {
  recordRendererGpuUncapturedError(message);
  rendererDiagnosticsState = {
    ...rendererDiagnosticsState,
    gpuTelemetry: snapshotRendererGpuTelemetry(),
  };
  syncRendererDiagnosticsWindow();
}

export function setRendererDiagnosticCapabilities(capabilities: RendererBackendCapabilities): void {
  rendererDiagnosticsState.capabilities = { ...capabilities };
  syncRendererDiagnosticsWindow();
}

export function setRendererDiagnosticDegradations(degradations: RendererFeatureDegradation[]): void {
  rendererDiagnosticsState.degradations = degradations.map((degradation) => ({ ...degradation }));
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
    mode: policy.mode,
    prewarmStrategy: policy.prewarmStrategy,
    unsupportedFeatures: [...policy.unsupportedFeatures],
  };
  syncRendererDiagnosticsWindow();
}

export function setRendererDiagnosticSceneName(sceneName: string): void {
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
    postprocessPolicy: rendererDiagnosticsState.postprocessPolicy
      ? {
          mode: rendererDiagnosticsState.postprocessPolicy.mode,
          prewarmStrategy: rendererDiagnosticsState.postprocessPolicy.prewarmStrategy,
          unsupportedFeatures: [...rendererDiagnosticsState.postprocessPolicy.unsupportedFeatures],
        }
      : null,
  };
}

export function resetRendererDiagnostics(): void {
  resetRendererGpuTelemetry();
  rendererDiagnosticsState = createRendererDiagnosticsState();
  syncRendererDiagnosticsWindow();
}
