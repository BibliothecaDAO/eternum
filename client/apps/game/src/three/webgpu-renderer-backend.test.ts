// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createWebGPURendererBackend } from "./webgpu-renderer-backend";

function createRendererSurface() {
  return {
    autoClear: false,
    clear: vi.fn(),
    clearDepth: vi.fn(),
    dispose: vi.fn(),
    domElement: document.createElement("canvas"),
    info: {
      memory: { geometries: 0, textures: 0 },
      render: { calls: 0, triangles: 0 },
      reset: vi.fn(),
    },
    render: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    shadowMap: {
      enabled: false,
      type: 0,
    },
    toneMapping: 0,
    toneMappingExposure: 0,
  };
}

describe("createWebGPURendererBackend", () => {
  it("boots the experimental auto lane and reports native webgpu", async () => {
    const renderer = createRendererSurface();
    const init = vi.fn(async () => {});
    const backend = createWebGPURendererBackend(
      {
        graphicsSetting: "HIGH" as never,
        isMobileDevice: false,
        pixelRatio: 1.5,
        requestedMode: "experimental-webgpu-auto",
      },
      {
        createRenderer: vi.fn(async ({ forceWebGL }) => ({
          activeMode: forceWebGL ? ("webgl2-fallback" as const) : ("webgpu" as const),
          renderer: Object.assign(renderer, { init }),
        })),
        now: vi.fn(() => 100).mockReturnValueOnce(100).mockReturnValueOnce(124),
      },
    );

    const diagnostics = await backend.initialize();

    expect(init).toHaveBeenCalledTimes(1);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5);
    expect(renderer.setSize).toHaveBeenCalledWith(window.innerWidth, window.innerHeight);
    expect(diagnostics).toEqual({
      activeMode: "webgpu",
      buildMode: "experimental-webgpu-auto",
      fallbackReason: null,
      initTimeMs: 24,
      requestedMode: "experimental-webgpu-auto",
    });
  });

  it("uses the forced webgl fallback lane when requested", async () => {
    const backend = createWebGPURendererBackend(
      {
        graphicsSetting: "HIGH" as never,
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "experimental-webgpu-force-webgl",
      },
      {
        createRenderer: vi.fn(async ({ forceWebGL }) => ({
          activeMode: forceWebGL ? ("webgl2-fallback" as const) : ("webgpu" as const),
          renderer: Object.assign(createRendererSurface(), {
            init: vi.fn(async () => {}),
          }),
        })),
        now: vi.fn(() => 50).mockReturnValueOnce(50).mockReturnValueOnce(55),
      },
    );

    const diagnostics = await backend.initialize();

    expect(diagnostics.activeMode).toBe("webgl2-fallback");
    expect(diagnostics.requestedMode).toBe("experimental-webgpu-force-webgl");
  });
});
