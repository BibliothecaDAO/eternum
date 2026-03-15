import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/ui/config", () => ({
  GraphicsSettings: {
    LOW: "LOW",
  },
}));

import { createWebGLRendererBackend } from "./renderer-backend";
import type { RendererPostProcessController, RendererPostProcessPlan } from "./renderer-backend-v2";

function createRendererSurface() {
  return {
    autoClear: false,
    clear: vi.fn(),
    clearDepth: vi.fn(),
    dispose: vi.fn(),
    domElement: { nodeName: "CANVAS" } as HTMLCanvasElement,
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

function createPlan(): RendererPostProcessPlan {
  return {
    antiAlias: "fxaa",
    bloom: {
      enabled: true,
      intensity: 0.25,
    },
    chromaticAberration: {
      enabled: false,
    },
    colorGrade: {
      brightness: 0,
      contrast: 0.1,
      hue: 0,
      saturation: 0.2,
    },
    toneMapping: {
      exposure: 0.8,
      mode: "aces-filmic",
      whitePoint: 1,
    },
    vignette: {
      darkness: 0.3,
      enabled: true,
      offset: 0.2,
    },
  };
}

describe("createWebGLRendererBackend", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      innerHeight: 720,
      innerWidth: 1280,
    });
  });

  it("owns a backend-specific postprocess runtime for plan, size, frame, and disposal", () => {
    const renderer = createRendererSurface();
    const controller: RendererPostProcessController = {
      setColorGrade: vi.fn(),
      setVignette: vi.fn(),
    };
    const runtime = {
      dispose: vi.fn(),
      renderFrame: vi.fn(),
      setPlan: vi.fn(() => controller),
      setSize: vi.fn(),
    };

    const backend = createWebGLRendererBackend(
      {
        graphicsSetting: "HIGH" as never,
        isMobileDevice: false,
        pixelRatio: 1.5,
      },
      {
        createPostProcessRuntime: vi.fn(() => runtime),
        createRenderer: vi.fn(() => renderer as never),
      },
    );

    const plan = createPlan();
    const result = backend.applyPostProcessPlan(plan);

    backend.applyQuality({
      height: 360,
      pixelRatio: 2,
      shadows: true,
      width: 640,
    });
    backend.resize(800, 450);
    backend.renderFrame({
      mainCamera: { id: "main-camera" } as never,
      mainScene: { id: "main-scene" } as never,
    });
    backend.dispose();

    expect(result).toBe(controller);
    expect(runtime.setPlan).toHaveBeenCalledWith(plan);
    expect(renderer.setPixelRatio).toHaveBeenNthCalledWith(1, 1.5);
    expect(renderer.setPixelRatio).toHaveBeenNthCalledWith(2, 2);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(runtime.setSize).toHaveBeenNthCalledWith(1, window.innerWidth, window.innerHeight);
    expect(runtime.setSize).toHaveBeenNthCalledWith(2, 640, 360);
    expect(runtime.setSize).toHaveBeenNthCalledWith(3, 800, 450);
    expect(runtime.renderFrame).toHaveBeenCalledWith({
      mainCamera: { id: "main-camera" },
      mainScene: { id: "main-scene" },
    });
    expect(runtime.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });
});
