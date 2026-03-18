import { createRendererInitDiagnostics, type RendererBackendV2 } from "./renderer-backend-v2";
import {
  incrementRendererDiagnosticError,
  setRendererDiagnosticCapabilities,
  setRendererDiagnosticDegradations,
  syncRendererBackendDiagnostics,
} from "./renderer-diagnostics";
import {
  resolveRendererBuildModeFromSearch,
  type RendererBuildMode,
} from "./renderer-build-mode";

interface InitializedRendererBackend {
  backend: RendererBackendV2;
  diagnostics: ReturnType<typeof createRendererInitDiagnostics>;
}

export async function initializeSelectedRendererBackend(input: {
  experimentalFactory: (options: { requestedMode: Exclude<RendererBuildMode, "legacy-webgl"> }) => Promise<InitializedRendererBackend>;
  legacyFactory: () => Promise<InitializedRendererBackend>;
  options: {
    envBuildMode: RendererBuildMode;
    graphicsSetting: unknown;
    isMobileDevice: boolean;
    pixelRatio: number;
    search: string;
  };
}): Promise<InitializedRendererBackend & { fallbackError?: Error }> {
  const requestedMode = resolveRendererBuildModeFromSearch({
    envBuildMode: input.options.envBuildMode,
    search: input.options.search,
  });

  if (requestedMode === "legacy-webgl") {
    const legacy = await input.legacyFactory();
    syncRendererBackendDiagnostics(legacy.diagnostics);
    setRendererDiagnosticCapabilities(legacy.backend.capabilities);
    setRendererDiagnosticDegradations([]);
    return legacy;
  }

  try {
    const experimental = await input.experimentalFactory({
      requestedMode,
    });
    syncRendererBackendDiagnostics(experimental.diagnostics);
    setRendererDiagnosticCapabilities(experimental.backend.capabilities);
    setRendererDiagnosticDegradations([]);
    return experimental;
  } catch (error) {
    incrementRendererDiagnosticError("initErrors");
    const legacyStart = performance.now();
    const legacy = await input.legacyFactory();
    const legacyInitTimeMs = performance.now() - legacyStart;
    incrementRendererDiagnosticError("fallbacks");
    const diagnostics = createRendererInitDiagnostics({
      activeMode: "legacy-webgl",
      buildMode: input.options.envBuildMode,
      fallbackReason: "experimental-init-error",
      initTimeMs: legacyInitTimeMs,
      requestedMode,
    });
    syncRendererBackendDiagnostics(diagnostics);
    setRendererDiagnosticCapabilities(legacy.backend.capabilities);
    setRendererDiagnosticDegradations([]);

    return {
      ...legacy,
      diagnostics,
      fallbackError: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
