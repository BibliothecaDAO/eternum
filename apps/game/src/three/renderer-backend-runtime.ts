import * as Sentry from "@sentry/react";
import {
  incrementRendererDiagnosticError,
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
  removeRetiredRendererModePreference(getBrowserStorage());

  const backend = createWebGPURendererBackend({
    forceReprobe: hasExplicitRendererMode(input.search),
    isMobileDevice: input.isMobileDevice,
    onDeviceLost: input.onDeviceLost,
    pixelRatio: input.pixelRatio,
    requestedMode,
  });
  const diagnostics = await backend.initialize();
  return completeRendererBackendInitialization(backend, diagnostics);
}

export async function initializeRendererDeviceLossFallbackRuntime(
  input: Omit<InitializeRendererBackendRuntimeInput, "backendFactory" | "onDeviceLost">,
): Promise<{
  backend: RendererBackendRuntimeState;
  renderer: RendererSurfaceLike;
}> {
  const backend = createWebGPURendererBackend({
    isMobileDevice: input.isMobileDevice,
    pixelRatio: input.pixelRatio,
    requestedMode: "webgpu-force-webgl",
  });

  try {
    const diagnostics = await backend.initialize();
    incrementRendererDiagnosticError("fallbacks");
    return completeRendererBackendInitialization(backend, {
      ...diagnostics,
      fallbackReason: "webgpu-device-lost",
    });
  } catch (error) {
    backend.dispose?.();
    throw error;
  }
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
