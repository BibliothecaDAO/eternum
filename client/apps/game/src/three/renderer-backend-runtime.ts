import type { GraphicsSettings } from "@/ui/config";
import {
  incrementRendererDiagnosticError,
  setRendererDiagnosticCapabilities,
  setRendererDiagnosticDegradations,
  syncRendererBackendDiagnostics,
} from "./renderer-diagnostics";
import { initializeSelectedRendererBackend } from "./renderer-backend-loader";
import { createWebGLRendererBackend, type RendererBackendFactory, type RendererSurfaceLike } from "./renderer-backend";
import {
  createRendererInitDiagnostics,
  type RendererBackendV2,
  type RendererDeviceLostEvent,
} from "./renderer-backend-v2";
import type { RendererBuildMode } from "./renderer-build-mode";
import { RENDERER_MODE_STORAGE_KEY, resolveRendererBuildModeFromSearch } from "./renderer-build-mode";
import { createWebGPURendererBackend } from "./webgpu-renderer-backend";

type RendererBackendRuntimeState = RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };

interface InitializeRendererBackendRuntimeInput {
  backendFactory?: RendererBackendFactory;
  envBuildMode: RendererBuildMode;
  graphicsSetting: GraphicsSettings;
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
    return initializeRendererBackendFromFactory(input);
  }

  return initializeSelectedRendererBackendRuntime(input);
}

async function initializeRendererBackendFromFactory(input: InitializeRendererBackendRuntimeInput): Promise<{
  backend: RendererBackendRuntimeState;
  renderer: RendererSurfaceLike;
}> {
  const backend = input.backendFactory!({
    graphicsSetting: input.graphicsSetting,
    isMobileDevice: input.isMobileDevice,
    pixelRatio: input.pixelRatio,
  });
  const diagnostics = await backend.initialize();

  syncRendererBackendDiagnostics(diagnostics);
  setRendererDiagnosticCapabilities(backend.capabilities);
  setRendererDiagnosticDegradations([]);

  return {
    backend,
    renderer: backend.renderer,
  };
}

async function initializeSelectedRendererBackendRuntime(input: InitializeRendererBackendRuntimeInput): Promise<{
  backend: RendererBackendRuntimeState;
  renderer: RendererSurfaceLike;
}> {
  const result = await initializeSelectedRendererBackend({
    experimentalFactory: async ({ requestedMode }) => {
      const backend = createWebGPURendererBackend({
        graphicsSetting: input.graphicsSetting,
        isMobileDevice: input.isMobileDevice,
        onDeviceLost: input.onDeviceLost,
        pixelRatio: input.pixelRatio,
        requestedMode,
      });
      const diagnostics = await backend.initialize();

      return {
        backend,
        diagnostics,
      };
    },
    legacyFactory: async () => {
      const backend = createWebGLRendererBackend({
        graphicsSetting: input.graphicsSetting,
        isMobileDevice: input.isMobileDevice,
        pixelRatio: input.pixelRatio,
      });
      const diagnostics = await backend.initialize();

      return {
        backend,
        diagnostics,
      };
    },
    options: {
      envBuildMode: input.envBuildMode,
      graphicsSetting: input.graphicsSetting,
      isMobileDevice: input.isMobileDevice,
      pixelRatio: input.pixelRatio,
      search: input.search,
    },
  });

  const backend = result.backend as RendererBackendRuntimeState;

  return {
    backend,
    renderer: backend.renderer,
  };
}

export async function initializeRendererDeviceLossFallbackRuntime(
  input: Omit<InitializeRendererBackendRuntimeInput, "backendFactory" | "onDeviceLost">,
): Promise<{
  backend: RendererBackendRuntimeState;
  renderer: RendererSurfaceLike;
}> {
  const startedAt = performance.now();
  const backend = createWebGLRendererBackend({
    graphicsSetting: input.graphicsSetting,
    isMobileDevice: input.isMobileDevice,
    pixelRatio: input.pixelRatio,
  });

  try {
    await backend.initialize();
  } catch (error) {
    backend.dispose?.();
    throw error;
  }

  const diagnostics = createRendererInitDiagnostics({
    activeMode: "legacy-webgl",
    buildMode: input.envBuildMode,
    fallbackReason: "webgpu-device-lost",
    initTimeMs: performance.now() - startedAt,
    requestedMode: resolveRequestedModeBeforeDeviceLossFallback(input),
  });

  incrementRendererDiagnosticError("fallbacks");
  syncRendererBackendDiagnostics(diagnostics);
  setRendererDiagnosticCapabilities(backend.capabilities);
  setRendererDiagnosticDegradations([]);

  return {
    backend,
    renderer: backend.renderer,
  };
}

function resolveRequestedModeBeforeDeviceLossFallback(
  input: Omit<InitializeRendererBackendRuntimeInput, "backendFactory" | "onDeviceLost">,
): RendererBuildMode {
  return resolveRendererBuildModeFromSearch({
    envBuildMode: input.envBuildMode,
    search: input.search,
    userPreference: resolveRendererModeUserPreference(),
  });
}

function resolveRendererModeUserPreference(): string | undefined {
  if (typeof localStorage === "undefined") {
    return undefined;
  }

  return localStorage.getItem(RENDERER_MODE_STORAGE_KEY) ?? undefined;
}
