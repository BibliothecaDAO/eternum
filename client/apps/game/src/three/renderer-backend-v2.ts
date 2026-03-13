import type { GraphicsSettings as GraphicsSettingsType } from "@/ui/config";

import type { RendererSurfaceLike } from "./renderer-backend";
import type { RendererBuildMode } from "./renderer-build-mode";

export type RendererActiveMode = "legacy-webgl" | "webgpu" | "webgl2-fallback";

export interface RendererInitDiagnostics {
  activeMode: RendererActiveMode;
  buildMode: RendererBuildMode;
  fallbackReason: string | null;
  initTimeMs: number;
  requestedMode: RendererBuildMode;
}

export interface RendererBackendV2 {
  readonly renderer?: RendererSurfaceLike;
  initialize(): Promise<RendererInitDiagnostics>;
}

export type RendererBackendV2Factory = (options: {
  graphicsSetting: GraphicsSettingsType;
  isMobileDevice: boolean;
  pixelRatio: number;
}) => RendererBackendV2;

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
