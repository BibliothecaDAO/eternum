import * as Sentry from "@sentry/react";
import { verboseLog } from "@/utils/dev-mode";
import {
  setRendererDiagnosticCapabilities,
  setRendererDiagnosticDegradations,
  syncRendererBackendDiagnostics,
} from "./renderer-diagnostics";
import type { RendererBackendFactory, RendererSurfaceLike } from "./renderer-backend";
import type { RendererBackendV2, RendererDeviceLostEvent, RendererInitDiagnostics } from "./renderer-backend-v2";
import {
  removeRetiredRendererModePreference,
  resolveRendererBuildModeFromSearch,
  type RendererBuildMode,
  hasExplicitRendererMode,
} from "./renderer-build-mode";
import { createWebGPURendererBackend } from "./webgpu-renderer-backend";

type RendererBackendRuntimeState = RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };

interface InitializeRendererBackendRuntimeInput {
  backendFactory?: RendererBackendFactory;
  envBuildMode: RendererBuildMode;
  isMobileDevice: boolean;
  onDeviceLost?: (event: RendererDeviceLostEvent) => void;
  pixelRatio: number;
  search: string;
}

export async function initializeRendererBackendRuntime(input: InitializeRendererBackendRuntimeInput): Promise<{
  backend: RendererBackendRuntimeState;
  renderer: RendererSurfaceLike;
}> {
  if (input.backendFactory) {
    const backend = input.backendFactory({
      isMobileDevice: input.isMobileDevice,
      pixelRatio: input.pixelRatio,
    });
    const diagnostics = await backend.initialize();
    return completeRendererBackendInitialization(backend, diagnostics);
  }

  const requestedMode = resolveRendererBuildModeFromSearch({
    envBuildMode: input.envBuildMode,
    search: input.search,
  });
  const explicitOverride = hasExplicitRendererMode(input.search);
  removeRetiredRendererModePreference(getBrowserStorage());
  verboseLog("[RendererDebug]", {
    event: "renderer-init-requested",
    explicitOverride,
    requestedMode,
  });

  const backend = createWebGPURendererBackend({
    isMobileDevice: input.isMobileDevice,
    onDeviceLost: input.onDeviceLost,
    pixelRatio: input.pixelRatio,
    requestedMode,
  });
  const diagnostics = await backend.initialize();
  return completeRendererBackendInitialization(backend, diagnostics);
}

function completeRendererBackendInitialization(
  backend: RendererBackendV2,
  diagnostics: RendererInitDiagnostics,
): { backend: RendererBackendRuntimeState; renderer: RendererSurfaceLike } {
  if (!backend.renderer) {
    throw new Error("Renderer backend initialized without a rendering surface");
  }

  syncRendererBackendDiagnostics(diagnostics);
  setRendererDiagnosticCapabilities(backend.capabilities);
  setRendererDiagnosticDegradations([]);
  verboseLog("[RendererDebug]", {
    activeMode: diagnostics.activeMode,
    adapterInfo: diagnostics.adapterInfo ?? null,
    capabilities: backend.capabilities,
    event: "renderer-init-completed",
    fallbackReason: diagnostics.fallbackReason,
    initTimeMs: Math.round(diagnostics.initTimeMs),
    requestedMode: diagnostics.requestedMode,
  });
  // Resolved backend rides every Sentry report — the webgl2-fallback question
  // stays answerable from error data now that product analytics is gone.
  Sentry.getCurrentScope().setTags({
    renderer_backend: diagnostics.activeMode,
    renderer_build_mode: diagnostics.buildMode,
    ...(diagnostics.fallbackReason ? { renderer_fallback_reason: diagnostics.fallbackReason } : {}),
  });

  return {
    backend: backend as RendererBackendRuntimeState,
    renderer: backend.renderer,
  };
}

function getBrowserStorage(): Pick<Storage, "removeItem"> | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}
