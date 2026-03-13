import { createRendererInitDiagnostics, type RendererBackendV2 } from "./renderer-backend-v2";
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
    return input.legacyFactory();
  }

  try {
    return await input.experimentalFactory({
      requestedMode,
    });
  } catch (error) {
    const legacy = await input.legacyFactory();

    return {
      ...legacy,
      diagnostics: createRendererInitDiagnostics({
        activeMode: "legacy-webgl",
        buildMode: input.options.envBuildMode,
        fallbackReason: "experimental-init-error",
        requestedMode,
      }),
      fallbackError: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
