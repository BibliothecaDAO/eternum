import {
  createRendererInitDiagnostics,
  isRendererInitTimeoutError,
  type RendererBackendV2,
  type RendererFallbackReason,
} from "./renderer-backend-v2";
import {
  incrementRendererDiagnosticError,
  setRendererDiagnosticCapabilities,
  setRendererDiagnosticDegradations,
  syncRendererBackendDiagnostics,
} from "./renderer-diagnostics";
import {
  RENDERER_MODE_STORAGE_KEY,
  resolveRendererBuildModeFromSearch,
  type RendererBuildMode,
} from "./renderer-build-mode";
import { recordRendererStartupTiming } from "./perf/renderer-startup-telemetry";

interface InitializedRendererBackend {
  backend: RendererBackendV2;
  diagnostics: ReturnType<typeof createRendererInitDiagnostics>;
}

export async function initializeSelectedRendererBackend(input: {
  experimentalFactory: (options: {
    requestedMode: Exclude<RendererBuildMode, "legacy-webgl">;
  }) => Promise<InitializedRendererBackend>;
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
    userPreference: localStorage.getItem(RENDERER_MODE_STORAGE_KEY) ?? undefined,
  });

  if (requestedMode === "legacy-webgl") {
    const legacy = await runTimedBackendFactory("legacy-backend-total", input.legacyFactory);
    syncRendererBackendDiagnostics(legacy.diagnostics);
    setRendererDiagnosticCapabilities(legacy.backend.capabilities);
    setRendererDiagnosticDegradations([]);
    return legacy;
  }

  try {
    const experimental = await runTimedBackendFactory("experimental-backend-total", () =>
      input.experimentalFactory({
        requestedMode,
      }),
    );
    syncRendererBackendDiagnostics(experimental.diagnostics);
    setRendererDiagnosticCapabilities(experimental.backend.capabilities);
    setRendererDiagnosticDegradations([]);
    return experimental;
  } catch (error) {
    incrementRendererDiagnosticError("initErrors");
    const legacyStart = performance.now();
    const legacy = await input.legacyFactory();
    const legacyInitTimeMs = performance.now() - legacyStart;
    recordRendererStartupTiming("legacy-fallback-total", legacyInitTimeMs);
    incrementRendererDiagnosticError("fallbacks");
    const diagnostics = createRendererInitDiagnostics({
      activeMode: "legacy-webgl",
      buildMode: input.options.envBuildMode,
      fallbackReason: resolveExperimentalFallbackReason(error),
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

async function runTimedBackendFactory<T>(
  timingName: "experimental-backend-total" | "legacy-backend-total",
  factory: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await factory();
  } finally {
    recordRendererStartupTiming(timingName, performance.now() - startedAt);
  }
}

function resolveExperimentalFallbackReason(error: unknown): Exclude<RendererFallbackReason, null> {
  return isRendererInitTimeoutError(error) ? "experimental-init-timeout" : "experimental-init-error";
}
