import type { RendererInitDiagnostics, RendererPostProcessPlan } from "./renderer-backend-v2";

interface RendererDiagnosticsSnapshot {
  activeMode: RendererInitDiagnostics["activeMode"] | null;
  buildMode: RendererInitDiagnostics["buildMode"] | null;
  effectPlan: RendererPostProcessPlan | null;
  fallbackReason: string | null;
  fallbacks: number;
  initErrors: number;
  initTimeMs: number | null;
  requestedMode: RendererInitDiagnostics["requestedMode"] | null;
  sceneName: string | null;
}

const createRendererDiagnosticsState = (): RendererDiagnosticsSnapshot => ({
  activeMode: null,
  buildMode: null,
  effectPlan: null,
  fallbackReason: null,
  fallbacks: 0,
  initErrors: 0,
  initTimeMs: null,
  requestedMode: null,
  sceneName: null,
});

let rendererDiagnosticsState = createRendererDiagnosticsState();

export function syncRendererBackendDiagnostics(input: RendererInitDiagnostics): void {
  rendererDiagnosticsState = {
    ...rendererDiagnosticsState,
    activeMode: input.activeMode,
    buildMode: input.buildMode,
    fallbackReason: input.fallbackReason,
    initTimeMs: input.initTimeMs,
    requestedMode: input.requestedMode,
  };
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
}

export function setRendererDiagnosticSceneName(sceneName: string): void {
  rendererDiagnosticsState.sceneName = sceneName;
}

export function incrementRendererDiagnosticError(type: "fallbacks" | "initErrors", amount: number = 1): void {
  rendererDiagnosticsState[type] += Math.max(0, Math.floor(amount));
}

export function snapshotRendererDiagnostics(): RendererDiagnosticsSnapshot {
  return {
    ...rendererDiagnosticsState,
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
}
