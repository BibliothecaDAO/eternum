import { beforeEach, describe, expect, it, vi } from "vitest";

const initializeSelectedRendererBackend = vi.fn();
const syncRendererBackendDiagnostics = vi.fn();
const setRendererDiagnosticCapabilities = vi.fn();
const setRendererDiagnosticDegradations = vi.fn();
const createWebGLRendererBackend = vi.fn();
const createWebGPURendererBackend = vi.fn();

vi.mock("./renderer-backend-loader", () => ({
  initializeSelectedRendererBackend,
}));

vi.mock("./renderer-diagnostics", () => ({
  syncRendererBackendDiagnostics,
  setRendererDiagnosticCapabilities,
  setRendererDiagnosticDegradations,
}));

vi.mock("./renderer-backend", () => ({
  createWebGLRendererBackend,
}));

vi.mock("./webgpu-renderer-backend", () => ({
  createWebGPURendererBackend,
}));

const { initializeRendererBackendRuntime } = await import("./renderer-backend-runtime");

function createFakeBackend() {
  return {
    capabilities: { supportsBloom: true },
    renderer: { info: { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 }, reset: vi.fn() } },
    initialize: vi.fn(async () => ({
      activeMode: "legacy-webgl",
      buildMode: "legacy-webgl",
      fallbackReason: null,
      initTimeMs: 0,
      requestedMode: "legacy-webgl",
    })),
    resize: vi.fn(),
    applyQuality: vi.fn(),
    applyPostProcessPlan: vi.fn(),
    applyEnvironment: vi.fn(),
    renderFrame: vi.fn(),
    dispose: vi.fn(),
  };
}

describe("initializeRendererBackendRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes diagnostics for an injected backend factory", async () => {
    const backend = createFakeBackend();
    const backendFactory = vi.fn(() => backend);

    const result = await initializeRendererBackendRuntime({
      backendFactory,
      envBuildMode: "experimental-webgpu-auto",
      graphicsSetting: "HIGH" as never,
      isMobileDevice: false,
      pixelRatio: 1.25,
      search: "?rendererMode=legacy-webgl",
    });

    expect(backendFactory).toHaveBeenCalledWith({
      graphicsSetting: "HIGH",
      isMobileDevice: false,
      pixelRatio: 1.25,
    });
    expect(backend.initialize).toHaveBeenCalledTimes(1);
    expect(syncRendererBackendDiagnostics).toHaveBeenCalledTimes(1);
    expect(setRendererDiagnosticCapabilities).toHaveBeenCalledWith(backend.capabilities);
    expect(setRendererDiagnosticDegradations).toHaveBeenCalledWith([]);
    expect(result).toEqual({
      backend,
      renderer: backend.renderer,
    });
  });

  it("builds selected backend factories from renderer settings", async () => {
    const webgpuBackend = createFakeBackend();
    const webglBackend = createFakeBackend();
    createWebGPURendererBackend.mockReturnValue(webgpuBackend);
    createWebGLRendererBackend.mockReturnValue(webglBackend);

    initializeSelectedRendererBackend.mockImplementation(async (input) => {
      const experimentalResult = await input.experimentalFactory({
        requestedMode: "experimental-webgpu-auto",
      });
      const legacyResult = await input.legacyFactory();

      expect(createWebGPURendererBackend).toHaveBeenCalledWith({
        graphicsSetting: "HIGH",
        isMobileDevice: true,
        pixelRatio: 1.5,
        requestedMode: "experimental-webgpu-auto",
      });
      expect(createWebGLRendererBackend).toHaveBeenCalledWith({
        graphicsSetting: "HIGH",
        isMobileDevice: true,
        pixelRatio: 1.5,
      });
      expect(experimentalResult).toEqual({
        backend: webgpuBackend,
        diagnostics: await webgpuBackend.initialize.mock.results[0]?.value,
      });
      expect(legacyResult).toEqual({
        backend: webglBackend,
        diagnostics: await webglBackend.initialize.mock.results[0]?.value,
      });

      return {
        backend: webgpuBackend,
        diagnostics: await webgpuBackend.initialize.mock.results[0]?.value,
      };
    });

    const result = await initializeRendererBackendRuntime({
      envBuildMode: "experimental-webgpu-auto",
      graphicsSetting: "HIGH" as never,
      isMobileDevice: true,
      pixelRatio: 1.5,
      search: "?rendererMode=experimental-webgpu-auto",
    });

    expect(initializeSelectedRendererBackend).toHaveBeenCalledWith({
      experimentalFactory: expect.any(Function),
      legacyFactory: expect.any(Function),
      options: {
        envBuildMode: "experimental-webgpu-auto",
        graphicsSetting: "HIGH",
        isMobileDevice: true,
        pixelRatio: 1.5,
        search: "?rendererMode=experimental-webgpu-auto",
      },
    });
    expect(webgpuBackend.initialize).toHaveBeenCalledTimes(1);
    expect(webglBackend.initialize).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      backend: webgpuBackend,
      renderer: webgpuBackend.renderer,
    });
  });
});
