// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRendererBackendCapabilities, createRendererInitDiagnostics } from "./renderer-backend-v2";

const setSentryScopeTags = vi.fn();
const incrementRendererDiagnosticError = vi.fn();
const syncRendererBackendDiagnostics = vi.fn();
const setRendererDiagnosticCapabilities = vi.fn();
const setRendererDiagnosticDegradations = vi.fn();
const createWebGPURendererBackend = vi.fn();

vi.mock("@sentry/react", () => ({ getCurrentScope: () => ({ setTags: setSentryScopeTags }) }));
vi.mock("./renderer-diagnostics", () => ({
  incrementRendererDiagnosticError,
  syncRendererBackendDiagnostics,
  setRendererDiagnosticCapabilities,
  setRendererDiagnosticDegradations,
}));
vi.mock("./webgpu-renderer-backend", () => ({ createWebGPURendererBackend }));

const { initializeRendererBackendRuntime, initializeRendererDeviceLossFallbackRuntime } =
  await import("./renderer-backend-runtime");

function createFakeBackend(activeMode: "webgpu" | "webgl2-fallback" = "webgpu") {
  return {
    capabilities: createRendererBackendCapabilities({ supportsToneMappingControl: true }),
    renderer: {
      autoClear: false,
      clear: vi.fn(),
      clearDepth: vi.fn(),
      dispose: vi.fn(),
      domElement: document.createElement("canvas"),
      info: {
        render: { calls: 0, triangles: 0 },
        memory: { geometries: 0, textures: 0 },
        reset: vi.fn(),
      },
      render: vi.fn(),
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      shadowMap: { enabled: true, type: 1 },
      toneMapping: 1,
      toneMappingExposure: 0.8,
    },
    initialize: vi.fn(async () =>
      createRendererInitDiagnostics({
        activeMode,
        buildMode: activeMode === "webgpu" ? "webgpu-auto" : "webgpu-force-webgl",
        requestedMode: activeMode === "webgpu" ? "webgpu-auto" : "webgpu-force-webgl",
      }),
    ),
    dispose: vi.fn(),
  };
}

describe("renderer backend runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("initializes the selected WebGPU renderer and records its resolved backend", async () => {
    const backend = createFakeBackend();
    createWebGPURendererBackend.mockReturnValue(backend);
    localStorage.setItem("RENDERER_MODE", "retired-choice");

    const result = await initializeRendererBackendRuntime({
      envBuildMode: "webgpu-auto",
      isMobileDevice: true,
      pixelRatio: 1.5,
      search: "",
    });

    expect(createWebGPURendererBackend).toHaveBeenCalledWith({
      isMobileDevice: true,
      onDeviceLost: undefined,
      pixelRatio: 1.5,
      requestedMode: "webgpu-auto",
    });
    expect(localStorage.getItem("RENDERER_MODE")).toBeNull();
    expect(setSentryScopeTags).toHaveBeenCalledWith({
      renderer_backend: "webgpu",
      renderer_build_mode: "webgpu-auto",
    });
    expect(result).toEqual({ backend, renderer: backend.renderer });
  });

  it("restarts on the maintained WebGL2 fallback after device loss", async () => {
    const backend = createFakeBackend("webgl2-fallback");
    createWebGPURendererBackend.mockReturnValue(backend);

    const result = await initializeRendererDeviceLossFallbackRuntime({
      envBuildMode: "webgpu-auto",
      isMobileDevice: false,
      pixelRatio: 1,
      search: "",
    });

    expect(createWebGPURendererBackend).toHaveBeenCalledWith({
      isMobileDevice: false,
      pixelRatio: 1,
      requestedMode: "webgpu-force-webgl",
    });
    expect(incrementRendererDiagnosticError).toHaveBeenCalledWith("fallbacks");
    expect(syncRendererBackendDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        activeMode: "webgl2-fallback",
        fallbackReason: "webgpu-device-lost",
      }),
    );
    expect(result).toEqual({ backend, renderer: backend.renderer });
  });
});
