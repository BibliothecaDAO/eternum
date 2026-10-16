import type {
  RendererActiveMode,
  RendererBackendCapabilities,
  RendererCapabilityFeature,
  RendererFeatureDegradation,
  RendererInitDiagnostics,
} from "./renderer-backend";
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
  fallbackReason: string | null;
  fallbacks: number;
  gpuTelemetry: ReturnType<typeof snapshotRendererGpuTelemetry>;
  initErrors: number;
  initTimeMs: number | null;
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
  fallbackReason: null,
  fallbacks: 0,
  gpuTelemetry: snapshotRendererGpuTelemetry(),
  initErrors: 0,
  initTimeMs: null,
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
    gpuTelemetry: snapshotRendererGpuTelemetry(),
    startupTimings: snapshotRendererStartupTimings(),
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
