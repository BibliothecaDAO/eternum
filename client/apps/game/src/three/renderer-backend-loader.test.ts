import { describe, expect, it, vi } from "vitest";
import {
  createRendererBackendCapabilities,
  createRendererInitDiagnostics,
  type RendererBackend,
} from "./renderer-backend";
import { initializeSelectedRendererBackend } from "./renderer-backend-loader";

function createStubBackend(): RendererBackend {
  return {
    capabilities: createRendererBackendCapabilities(),
    initialize: vi.fn(),
  } as unknown as RendererBackend;
}

describe("initializeSelectedRendererBackend", () => {
  it("uses the legacy backend directly for the shipping lane", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
    });
    const legacyBackend = createStubBackend();
    const legacyFactory = vi.fn(async () => ({
      backend: legacyBackend,
      diagnostics: createRendererInitDiagnostics({
        activeMode: "legacy-webgl",
        buildMode: "legacy-webgl",
        requestedMode: "legacy-webgl",
      }),
    }));
    const experimentalFactory = vi.fn();

    const result = await initializeSelectedRendererBackend({
      experimentalFactory,
      legacyFactory,
      options: {
        envBuildMode: "legacy-webgl",
        graphicsSetting: "HIGH" as never,
        isMobileDevice: false,
        pixelRatio: 1,
        search: "?rendererMode=experimental-webgpu-auto",
      },
    });

    expect(legacyFactory).toHaveBeenCalledTimes(1);
    expect(experimentalFactory).not.toHaveBeenCalled();
    expect(result.diagnostics.activeMode).toBe("legacy-webgl");
    vi.unstubAllGlobals();
  });

  it("falls back to the legacy backend when experimental init fails", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
    });
    const error = new Error("webgpu init failed");
    const legacyFactory = vi.fn(async () => ({
      backend: createStubBackend(),
      diagnostics: createRendererInitDiagnostics({
        activeMode: "legacy-webgl",
        buildMode: "legacy-webgl",
        requestedMode: "legacy-webgl",
      }),
    }));
    const experimentalFactory = vi.fn(async () => {
      throw error;
    });

    const result = await initializeSelectedRendererBackend({
      experimentalFactory,
      legacyFactory,
      options: {
        envBuildMode: "experimental-webgpu-auto",
        graphicsSetting: "HIGH" as never,
        isMobileDevice: false,
        pixelRatio: 1,
        search: "?rendererMode=experimental-webgpu-auto",
      },
    });

    expect(experimentalFactory).toHaveBeenCalledTimes(1);
    expect(legacyFactory).toHaveBeenCalledTimes(1);
    expect(result.diagnostics).toEqual({
      activeMode: "legacy-webgl",
      buildMode: "experimental-webgpu-auto",
      fallbackReason: "experimental-init-error",
      initTimeMs: expect.any(Number),
      requestedMode: "experimental-webgpu-auto",
    });
    expect(result.fallbackError).toBe(error);
    vi.unstubAllGlobals();
  });
});
