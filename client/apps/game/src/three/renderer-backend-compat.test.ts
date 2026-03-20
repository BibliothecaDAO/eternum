import { describe, expect, it, vi } from "vitest";
import {
  applyRendererBackendEnvironment,
  applyRendererBackendPostProcessPlan,
  applyRendererBackendQuality,
  disposeRendererBackend,
  renderRendererBackendFrame,
  resizeRendererBackend,
} from "./renderer-backend-compat";

function createRenderer() {
  return {
    clear: vi.fn(),
    clearDepth: vi.fn(),
    dispose: vi.fn(),
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
  };
}

describe("renderer backend compat", () => {
  it("skips optional environment hooks when a backend does not implement them", async () => {
    const backend = {
      renderer: createRenderer(),
    };

    await expect(
      applyRendererBackendEnvironment(backend as never, {
        hexceptionScene: { setEnvironment: vi.fn() },
        intensity: 0.1,
        worldmapScene: { setEnvironment: vi.fn() },
      }),
    ).resolves.toBeUndefined();
  });

  it("falls back to renderer surface methods for quality and resize", () => {
    const renderer = createRenderer();
    const backend = {
      renderer,
    };

    applyRendererBackendQuality(backend as never, {
      height: 360,
      pixelRatio: 1.5,
      shadows: true,
      width: 640,
    });
    resizeRendererBackend(backend as never, 800, 600);

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.setSize).toHaveBeenNthCalledWith(1, 640, 360);
    expect(renderer.setSize).toHaveBeenNthCalledWith(2, 800, 600);
  });

  it("falls back to direct renderer calls for frame rendering", () => {
    const renderer = createRenderer();
    const backend = {
      renderer,
    };

    renderRendererBackendFrame(backend as never, {
      mainCamera: "main-camera" as never,
      mainScene: "main-scene" as never,
      overlayPasses: [
        {
          camera: "interaction-camera" as never,
          scene: "interaction-overlay-scene" as never,
        },
        {
          camera: "hud-camera" as never,
          scene: "hud-overlay-scene" as never,
        },
      ],
    });

    expect(renderer.info.reset).toHaveBeenCalled();
    expect(renderer.clear).toHaveBeenCalled();
    expect(renderer.render).toHaveBeenNthCalledWith(1, "main-scene", "main-camera");
    expect(renderer.clearDepth).toHaveBeenCalledTimes(2);
    expect(renderer.render).toHaveBeenNthCalledWith(2, "interaction-overlay-scene", "interaction-camera");
    expect(renderer.render).toHaveBeenNthCalledWith(3, "hud-overlay-scene", "hud-camera");
  });

  it("provides no-op postprocess and dispose fallbacks when optional hooks are missing", () => {
    const renderer = createRenderer();
    const backend = {
      renderer,
    };

    const controller = applyRendererBackendPostProcessPlan(backend as never, {
      antiAlias: "none",
      bloom: {
        enabled: false,
        intensity: 0,
      },
      chromaticAberration: {
        enabled: false,
      },
      colorGrade: {
        brightness: 0,
        contrast: 0,
        hue: 0,
        saturation: 0,
      },
      toneMapping: {
        exposure: 1,
        mode: "linear",
        whitePoint: 1,
      },
      vignette: {
        darkness: 0,
        enabled: false,
        offset: 0,
      },
    });

    controller.setColorGrade({ saturation: 0.2 });
    controller.setVignette({ darkness: 0.3 });
    disposeRendererBackend(backend as never);

    expect(renderer.dispose).toHaveBeenCalled();
  });
});
