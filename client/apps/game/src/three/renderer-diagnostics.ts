import type {
  RendererBackendCapabilities,
  RendererFeatureDegradation,
  RendererInitDiagnostics,
  RendererPostProcessPlan,
} from "./renderer-backend-v2";

interface RendererDiagnosticsSnapshot {
  activeMode: RendererInitDiagnostics["activeMode"] | null;
  buildMode: RendererInitDiagnostics["buildMode"] | null;
  capabilities: RendererBackendCapabilities | null;
  degradations: RendererFeatureDegradation[];
  effectPlan: RendererPostProcessPlan | null;
  fallbackReason: string | null;
  fallbacks: number;
  initErrors: number;
  initTimeMs: number | null;
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
  initErrors: 0,
  initTimeMs: null,
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
  rendererDiagnosticsState = {
    ...rendererDiagnosticsState,
    activeMode: input.activeMode,
    buildMode: input.buildMode,
    fallbackReason: input.fallbackReason,
    initTimeMs: input.initTimeMs,
    requestedMode: input.requestedMode,
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
  };
}

export function resetRendererDiagnostics(): void {
  rendererDiagnosticsState = createRendererDiagnosticsState();
  syncRendererDiagnosticsWindow();
}
