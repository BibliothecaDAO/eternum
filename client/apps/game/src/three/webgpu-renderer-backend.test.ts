import { ACESFilmicToneMapping, CineonToneMapping, ReinhardToneMapping } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRendererDiagnostics, snapshotRendererDiagnostics, syncRendererBackendDiagnostics } from "./renderer-diagnostics";
import { createWebGPURendererBackend } from "./webgpu-renderer-backend";

beforeEach(() => {
  vi.stubGlobal("window", {
    innerHeight: 720,
    innerWidth: 1280,
  });
  vi.stubGlobal("document", {
    createElement: vi.fn(() => ({ nodeName: "CANVAS" })),
  });
  resetRendererDiagnostics();
});

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
  it("advertises only the renderer capabilities it actually implements", () => {
    const backend = createWebGPURendererBackend(
      {
        graphicsSetting: "HIGH" as never,
        isMobileDevice: false,
        pixelRatio: 1.5,
        requestedMode: "experimental-webgpu-auto",
      },
      {
        createRenderer: vi.fn(),
        now: vi.fn(() => 100),
      },
    );

    expect(backend.capabilities).toEqual({
      supportsBloom: false,
      supportsChromaticAberration: false,
      supportsColorGrade: false,
      supportsEnvironmentIbl: false,
      supportsToneMappingControl: false,
      supportsVignette: false,
      supportsWideLines: false,
    });
  });

  it("disposes a partially created renderer when initialization fails", async () => {
    const renderer = Object.assign(createRendererSurface(), {
      init: vi.fn(async () => {
        throw new Error("init failed");
      }),
    });
    const backend = createWebGPURendererBackend(
      {
        graphicsSetting: "HIGH" as never,
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "experimental-webgpu-auto",
      },
      {
        createRenderer: vi.fn(async () => ({
          activeMode: "webgpu" as const,
          renderer,
        })),
        now: vi.fn(() => 0),
      },
    );

    await expect(backend.initialize()).rejects.toThrow("init failed");

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(backend.renderer).toBeUndefined();
  });

  it("marks the diagnostics as degraded when the gpu device is lost", async () => {
    let resolveLost: ((value: { message: string }) => void) | undefined;
    const renderer = Object.assign(createRendererSurface(), {
      init: vi.fn(async () => {}),
    });
    const backend = createWebGPURendererBackend(
      {
        graphicsSetting: "HIGH" as never,
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "experimental-webgpu-auto",
      },
      {
        createRenderer: vi.fn(async () => ({
          activeMode: "webgpu" as const,
          device: {
            lost: new Promise<{ message: string }>((resolve) => {
              resolveLost = resolve;
            }),
          },
          renderer,
        })),
        now: vi.fn(() => 10).mockReturnValueOnce(10).mockReturnValueOnce(15),
      },
    );

    syncRendererBackendDiagnostics(await backend.initialize());
    expect(snapshotRendererDiagnostics().activeMode).toBe("webgpu");

    resolveLost?.({ message: "device lost during frame" });
    await Promise.resolve();

    expect(snapshotRendererDiagnostics()).toMatchObject({
      activeMode: null,
      fallbackReason: "webgpu-device-lost",
      gpuTelemetry: {
        activeMode: "webgpu",
        deviceLossMessage: "device lost during frame",
        deviceStatus: "lost",
      },
    });
  });

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

  it("applies renderer-supported tone mapping controls directly when the native runtime is disabled", async () => {
    const renderer = createRendererSurface();
    const backend = createWebGPURendererBackend(
      {
        graphicsSetting: "HIGH" as never,
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "experimental-webgpu-auto",
      },
      {
        createRenderer: vi.fn(async () => ({
          activeMode: "webgpu" as const,
          renderer: Object.assign(renderer, {
            init: vi.fn(async () => {}),
          }),
        })),
        now: vi.fn(() => 0),
      },
    );

    await backend.initialize();

    backend.applyPostProcessPlan?.({
      antiAlias: "none",
      bloom: { enabled: true, intensity: 0.4 },
      chromaticAberration: { enabled: true },
      colorGrade: {
        brightness: 0.1,
        contrast: 0.2,
        hue: 0.3,
        saturation: 0.4,
      },
      toneMapping: {
        exposure: 1.25,
        mode: "cineon",
        whitePoint: 1,
      },
      vignette: {
        darkness: 0.5,
        enabled: true,
        offset: 0.25,
      },
    });

    expect(renderer.toneMapping).toBe(CineonToneMapping);
    expect(renderer.toneMappingExposure).toBe(1.25);

    backend.applyPostProcessPlan?.({
      antiAlias: "none",
      bloom: { enabled: false, intensity: 0 },
      chromaticAberration: { enabled: false },
      colorGrade: {
        brightness: 0,
        contrast: 0,
        hue: 0,
        saturation: 0,
      },
      toneMapping: {
        exposure: 0.9,
        mode: "neutral",
        whitePoint: 1,
      },
      vignette: {
        darkness: 0,
        enabled: false,
        offset: 0,
      },
    });

    expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(0.9);

    backend.applyPostProcessPlan?.({
      antiAlias: "none",
      bloom: { enabled: false, intensity: 0 },
      chromaticAberration: { enabled: false },
      colorGrade: {
        brightness: 0,
        contrast: 0,
        hue: 0,
        saturation: 0,
      },
      toneMapping: {
        exposure: 0.7,
        mode: "reinhard",
        whitePoint: 1,
      },
      vignette: {
        darkness: 0,
        enabled: false,
        offset: 0,
      },
    });

    expect(renderer.toneMapping).toBe(ReinhardToneMapping);
    expect(renderer.toneMappingExposure).toBe(0.7);
  });

  it("owns quality, resize, frame rendering, and disposal once initialized", async () => {
    const renderer = createRendererSurface();
    const backend = createWebGPURendererBackend(
      {
        graphicsSetting: "HIGH" as never,
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "experimental-webgpu-auto",
      },
      {
        createRenderer: vi.fn(async () => ({
          activeMode: "webgpu" as const,
          renderer: Object.assign(renderer, {
            init: vi.fn(async () => {}),
          }),
        })),
        now: vi.fn(() => 0),
      },
    );

    await backend.initialize();

    backend.applyQuality?.({
      pixelRatio: 1.5,
      shadows: true,
      width: 640,
      height: 360,
    });
    backend.resize?.(800, 450);
    backend.renderFrame?.({
      mainCamera: { id: "main-camera" } as never,
      mainScene: { id: "main-scene" } as never,
      overlayPasses: [
        {
          camera: { id: "overlay-camera" } as never,
          scene: { id: "overlay-scene" } as never,
        },
      ],
    });
    backend.dispose?.();

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.setSize).toHaveBeenNthCalledWith(2, 640, 360);
    expect(renderer.setSize).toHaveBeenNthCalledWith(3, 800, 450);
    expect(renderer.info.reset).toHaveBeenCalledTimes(1);
    expect(renderer.clear).toHaveBeenCalledTimes(1);
    expect(renderer.clearDepth).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(backend.renderer).toBeUndefined();
  });
});
