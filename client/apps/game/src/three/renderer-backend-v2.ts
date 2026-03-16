import type { GraphicsSettings as GraphicsSettingsType } from "@/ui/config";
import type { Camera, Scene } from "three";

import type { RendererSurfaceLike } from "./renderer-backend";
import type { RendererBuildMode } from "./renderer-build-mode";

export type RendererActiveMode = "legacy-webgl" | "webgpu" | "webgl2-fallback";

export interface RendererBackendCapabilities {
  supportsEnvironmentIbl: boolean;
  supportsToneMappingControl: boolean;
  supportsColorGrade: boolean;
  supportsWorldWeatherFx: boolean;
  supportsWeatherColorPostFx: boolean;
  fallbackLightingMode: "none" | "no-ibl-balanced-rig";
  supportsBloom: boolean;
  supportsVignette: boolean;
  supportsChromaticAberration: boolean;
  supportsWideLines: boolean;
}

export type RendererCapabilityFeature =
  | "environmentIbl"
  | "toneMappingControl"
  | "colorGrade"
  | "bloom"
  | "vignette"
  | "chromaticAberration"
  | "wideLines";

export interface RendererFeatureDegradation {
  detail?: string;
  feature: RendererCapabilityFeature;
  reason: "disabled-by-quality" | "disabled-by-user" | "fallback-active" | "unsupported-backend";
}

export interface RendererInitDiagnostics {
  activeMode: RendererActiveMode;
  buildMode: RendererBuildMode;
  fallbackReason: string | null;
  initTimeMs: number;
  requestedMode: RendererBuildMode;
}

export interface RendererBackendV2 {
  readonly capabilities: RendererBackendCapabilities;
  readonly renderer?: RendererSurfaceLike;
  applyEnvironment?(targets: unknown): Promise<void>;
  applyPostProcessPlan?(plan: RendererPostProcessPlan): RendererPostProcessController;
  applyQuality?(input: { pixelRatio: number; shadows: boolean; width: number; height: number }): void;
  initialize(): Promise<RendererInitDiagnostics>;
  renderFrame?(pipeline: RendererFramePipeline): void;
  resize?(width: number, height: number): void;
}

export interface RendererFramePipeline {
  mainCamera: Camera;
  mainScene: Scene;
  overlayCamera?: Camera;
  overlayScene?: Scene;
  sceneName?: string;
}

export interface RendererPostProcessPlan {
  antiAlias: "fxaa" | "none";
  bloom: {
    enabled: boolean;
    intensity: number;
  };
  chromaticAberration: {
    enabled: boolean;
  };
  colorGrade: {
    brightness: number;
    contrast: number;
    hue: number;
    saturation: number;
  };
  toneMapping: {
    exposure: number;
    mode: "aces-filmic" | "cineon" | "linear" | "neutral" | "reinhard";
    whitePoint: number;
  };
  vignette: {
    darkness: number;
    enabled: boolean;
    offset: number;
  };
}

export interface RendererPostProcessController {
  setColorGrade(input: Partial<RendererPostProcessPlan["colorGrade"]>): void;
  setVignette(input: Partial<Omit<RendererPostProcessPlan["vignette"], "enabled">>): void;
}

export interface RendererPostProcessRuntime {
  dispose(): void;
  renderFrame(pipeline: RendererFramePipeline): void;
  setPlan(plan: RendererPostProcessPlan): RendererPostProcessController;
  setSize(width: number, height: number): void;
}

export type RendererBackendV2Factory = (options: {
  graphicsSetting: GraphicsSettingsType;
  isMobileDevice: boolean;
  pixelRatio: number;
}) => RendererBackendV2;

export function createRendererBackendCapabilities(
  input: Partial<RendererBackendCapabilities> = {},
): RendererBackendCapabilities {
  return {
    supportsBloom: input.supportsBloom ?? false,
    supportsChromaticAberration: input.supportsChromaticAberration ?? false,
    supportsColorGrade: input.supportsColorGrade ?? false,
    supportsEnvironmentIbl: input.supportsEnvironmentIbl ?? false,
    supportsWorldWeatherFx: input.supportsWorldWeatherFx ?? true,
    supportsWeatherColorPostFx: input.supportsWeatherColorPostFx ?? false,
    fallbackLightingMode: input.fallbackLightingMode ?? "none",
    supportsToneMappingControl: input.supportsToneMappingControl ?? false,
    supportsVignette: input.supportsVignette ?? false,
    supportsWideLines: input.supportsWideLines ?? false,
  };
}

export function createRendererInitDiagnostics(
  input: Pick<RendererInitDiagnostics, "activeMode" | "buildMode" | "requestedMode"> &
    Partial<Pick<RendererInitDiagnostics, "fallbackReason" | "initTimeMs">>,
): RendererInitDiagnostics {
  return {
    activeMode: input.activeMode,
    buildMode: input.buildMode,
    fallbackReason: input.fallbackReason ?? null,
    initTimeMs: input.initTimeMs ?? 0,
    requestedMode: input.requestedMode,
  };
}

export async function initializeRendererBackendV2(
  factory: RendererBackendV2Factory,
  options: Parameters<RendererBackendV2Factory>[0],
): Promise<{
  backend: RendererBackendV2;
  diagnostics: RendererInitDiagnostics;
}> {
  const backend = factory(options);
  const diagnostics = await backend.initialize();

  return {
    backend,
    diagnostics,
  };
}
