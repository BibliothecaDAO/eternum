import type { GraphicsSettings } from "@/ui/config";
import {
  setRendererDiagnosticCapabilities,
  setRendererDiagnosticDegradations,
  syncRendererBackendDiagnostics,
} from "./renderer-diagnostics";
import { initializeSelectedRendererBackend } from "./renderer-backend-loader";
import { createWebGLRendererBackend, type RendererBackendFactory, type RendererSurfaceLike } from "./renderer-backend";
import type { RendererBackendV2 } from "./renderer-backend-v2";
import type { RendererBuildMode } from "./renderer-build-mode";
import { createWebGPURendererBackend } from "./webgpu-renderer-backend";

type RendererBackendRuntimeState = RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };

interface InitializeRendererBackendRuntimeInput {
  backendFactory?: RendererBackendFactory;
  envBuildMode: RendererBuildMode;
  graphicsSetting: GraphicsSettings;
  isMobileDevice: boolean;
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
