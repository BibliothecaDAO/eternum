import { createRendererInitDiagnostics, type RendererBackendV2 } from "./renderer-backend-v2";
import { incrementRendererDiagnosticError, syncRendererBackendDiagnostics } from "./renderer-diagnostics";
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
    return legacy;
  }

  try {
    const experimental = await input.experimentalFactory({
      requestedMode,
    });
    syncRendererBackendDiagnostics(experimental.diagnostics);
    return experimental;
  } catch (error) {
    incrementRendererDiagnosticError("initErrors");
    const legacy = await input.legacyFactory();
    incrementRendererDiagnosticError("fallbacks");
    const diagnostics = createRendererInitDiagnostics({
      activeMode: "legacy-webgl",
      buildMode: input.options.envBuildMode,
      fallbackReason: "experimental-init-error",
      requestedMode,
    });
    syncRendererBackendDiagnostics(diagnostics);

    return {
      ...legacy,
      diagnostics,
      fallbackError: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
