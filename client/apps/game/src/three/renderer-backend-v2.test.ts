import { describe, expect, it, vi } from "vitest";
import {
  createRendererInitDiagnostics,
  initializeRendererBackendV2,
  type RendererBackendV2,
  type RendererBackendV2Factory,
} from "./renderer-backend-v2";

describe("initializeRendererBackendV2", () => {
  it("awaits backend initialization and returns its diagnostics", async () => {
    const diagnostics = createRendererInitDiagnostics({
      activeMode: "webgpu",
      buildMode: "experimental-webgpu-auto",
      requestedMode: "experimental-webgpu-auto",
    });
    const initialize = vi.fn(async () => diagnostics);
    const backend = { initialize } as unknown as RendererBackendV2;
    const factory: RendererBackendV2Factory = vi.fn(() => backend);

    const result = await initializeRendererBackendV2(factory, {
      graphicsSetting: "HIGH" as never,
      isMobileDevice: false,
      pixelRatio: 1,
    });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      backend,
      diagnostics,
    });
  });

  it("propagates initialization failures so the caller can apply fallback policy", async () => {
    const error = new Error("init failed");
    const backend = {
      initialize: vi.fn(async () => {
        throw error;
      }),
    } as unknown as RendererBackendV2;

    await expect(
      initializeRendererBackendV2(() => backend, {
        graphicsSetting: "HIGH" as never,
        isMobileDevice: false,
        pixelRatio: 1,
      }),
    ).rejects.toThrow("init failed");
  });
});

describe("createRendererInitDiagnostics", () => {
  it("defaults fallback reason and counters consistently", () => {
    expect(
      createRendererInitDiagnostics({
        activeMode: "legacy-webgl",
        buildMode: "legacy-webgl",
        requestedMode: "legacy-webgl",
      }),
    ).toEqual({
      activeMode: "legacy-webgl",
      buildMode: "legacy-webgl",
      fallbackReason: null,
      initTimeMs: 0,
      requestedMode: "legacy-webgl",
    });
  });
});
