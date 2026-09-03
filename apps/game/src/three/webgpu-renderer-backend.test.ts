import { ACESFilmicToneMapping, CineonToneMapping, NeutralToneMapping, ReinhardToneMapping } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetRendererDiagnostics,
  snapshotRendererDiagnostics,
  syncRendererBackendDiagnostics,
} from "./renderer-diagnostics";
import { RendererInitTimeoutError } from "./renderer-backend-v2";
import { resetRendererStartupTimings, snapshotRendererStartupTimings } from "./perf/renderer-startup-telemetry";
import { createWebGPURendererBackend } from "./webgpu-renderer-backend";
import { createRenderableOverlayScene } from "./renderer-overlay-passes.test-fixture";

const threeWebGpuMock = vi.hoisted(() => ({
  rendererParameters: [] as Array<{ forceWebGL: boolean }>,
}));

/** The lane question is answered by an injected probe; production reads navigator.gpu with a bound. */
const webGpuLane = () => ({
  rememberLane: vi.fn(),
  resolveLaneStart: vi.fn(async ({ requestedMode }: { requestedMode: string }) => ({
    fallbackReason: null,
    forceWebGL: requestedMode === "webgpu-force-webgl",
    remembered: false,
  })),
});

vi.mock("three/webgpu", () => ({
  ACESFilmicToneMapping: 4,
  HalfFloatType: 1016,
  PCFShadowMap: 1,
  PCFSoftShadowMap: 2,
  UnsignedByteType: 1009,
  WebGPURenderer: class {
    constructor(parameters: { forceWebGL: boolean }) {
      threeWebGpuMock.rendererParameters.push(parameters);
      Object.assign(this, createRendererSurface(), { init: vi.fn(async () => {}) });
    }
  },
}));

beforeEach(() => {
  vi.stubGlobal("window", {
    innerHeight: 720,
    innerWidth: 1280,
  });
  vi.stubGlobal("document", {
    createElement: vi.fn(() => Object.assign(new EventTarget(), { nodeName: "CANVAS" })),
  });
  resetRendererDiagnostics();
  resetRendererStartupTimings();
  threeWebGpuMock.rendererParameters.length = 0;
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
        isMobileDevice: false,
        pixelRatio: 1.5,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
        createRenderer: vi.fn(),
        now: vi.fn(() => 100),
      },
    );

    expect(backend.capabilities).toEqual({
      supportsBloom: false,
      supportsChromaticAberration: false,
      supportsColorGrade: false,
      supportsEnvironmentIbl: false,
      supportsToneMappingControl: true,
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
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
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

  it("hands a stalled WebGPU lane over to WebGL2 instead of failing bootstrap", async () => {
    vi.useFakeTimers();
    const webGpuRenderer = Object.assign(createRendererSurface(), {
      init: vi.fn(() => new Promise<void>(() => {})),
    });
    const webGlRenderer = Object.assign(createRendererSurface(), {
      init: vi.fn(async () => {}),
    });
    const createRenderer = vi.fn(async ({ forceWebGL }: { forceWebGL: boolean }) =>
      forceWebGL
        ? { activeMode: "webgl2-fallback" as const, renderer: webGlRenderer }
        : { activeMode: "webgpu" as const, renderer: webGpuRenderer },
    );
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      { ...webGpuLane(), createRenderer, now: vi.fn(() => 0) },
    );

    const initPromise = backend.initialize();
    await vi.advanceTimersByTimeAsync(15_000);

    await expect(initPromise).resolves.toEqual(
      expect.objectContaining({ activeMode: "webgl2-fallback", fallbackReason: "webgpu-init-timeout" }),
    );
    expect(createRenderer.mock.calls.map(([input]) => input.forceWebGL)).toEqual([false, true]);
    expect(webGpuRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(backend.renderer).toBe(webGlRenderer);
    vi.useRealTimers();
  });

  it("gives up when the WebGL2 lane stalls as well", async () => {
    vi.useFakeTimers();
    const renderers: Array<ReturnType<typeof createRendererSurface> & { init: () => Promise<void> }> = [];
    const createRenderer = vi.fn(async ({ forceWebGL }: { forceWebGL: boolean }) => {
      const renderer = Object.assign(createRendererSurface(), { init: vi.fn(() => new Promise<void>(() => {})) });
      renderers.push(renderer);
      return { activeMode: forceWebGL ? ("webgl2-fallback" as const) : ("webgpu" as const), renderer };
    });
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      { ...webGpuLane(), createRenderer, now: vi.fn(() => 0) },
    );

    const initPromise = backend.initialize();
    const initExpectation = expect(initPromise).rejects.toThrow(RendererInitTimeoutError);
    await vi.advanceTimersByTimeAsync(30_000);

    await initExpectation;
    expect(renderers).toHaveLength(2);
    renderers.forEach((renderer) => expect(renderer.dispose).toHaveBeenCalledTimes(1));
    expect(backend.renderer).toBeUndefined();
    vi.useRealTimers();
  });

  it("does not retry a stalled lane that was already WebGL2", async () => {
    vi.useFakeTimers();
    const renderer = Object.assign(createRendererSurface(), {
      init: vi.fn(() => new Promise<void>(() => {})),
    });
    const createRenderer = vi.fn(async () => ({ activeMode: "webgl2-fallback" as const, renderer }));
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-force-webgl",
      },
      { ...webGpuLane(), createRenderer, now: vi.fn(() => 0) },
    );

    const initPromise = backend.initialize();
    const initExpectation = expect(initPromise).rejects.toThrow("Renderer startup timed out after 15000ms");
    await vi.advanceTimersByTimeAsync(15_000);

    await initExpectation;
    expect(createRenderer).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(backend.renderer).toBeUndefined();
    vi.useRealTimers();
  });

  it("builds the WebGL2 backend directly when the bounded probe says no adapter", async () => {
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
        now: vi.fn(() => 0),
        resolveLaneStart: vi.fn(async () => ({
          fallbackReason: "webgpu-unavailable" as const,
          forceWebGL: true,
          remembered: false,
        })),
      },
    );

    const diagnostics = await backend.initialize();

    expect(threeWebGpuMock.rendererParameters).toEqual([{ forceWebGL: true }]);
    expect(diagnostics).toEqual(
      expect.objectContaining({ activeMode: "webgl2-fallback", fallbackReason: "webgpu-unavailable" }),
    );
  });

  it("boots a cold profile on WebGL2 and records a successful WebGPU qualification at idle", async () => {
    const idle: Array<() => void> = [];
    const lane = webGpuLane();
    const webGlRenderer = Object.assign(createRendererSurface(), { init: vi.fn(async () => {}) });
    const webGpuRenderer = Object.assign(createRendererSurface(), { init: vi.fn(async () => {}) });
    const createRenderer = vi.fn(async ({ forceWebGL }: { forceWebGL: boolean }) => ({
      activeMode: forceWebGL ? ("webgl2-fallback" as const) : ("webgpu" as const),
      renderer: forceWebGL ? webGlRenderer : webGpuRenderer,
    }));
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...lane,
        createRenderer,
        now: vi.fn(() => 0),
        resolveLaneStart: vi.fn(async () => ({
          fallbackReason: "webgpu-unproven" as const,
          forceWebGL: true,
          qualifyAtIdle: true,
          remembered: false,
        })),
        scheduleIdle: (work) => void idle.push(work),
      },
    );

    await expect(backend.initialize()).resolves.toEqual(
      expect.objectContaining({ activeMode: "webgl2-fallback", fallbackReason: "webgpu-unproven" }),
    );
    expect(createRenderer.mock.calls.map(([input]) => input.forceWebGL)).toEqual([true]);

    idle[0]();
    await vi.waitFor(() => expect(lane.rememberLane).toHaveBeenCalledWith("webgpu", "idle:init-ok"));
    expect(createRenderer.mock.calls.map(([input]) => input.forceWebGL)).toEqual([true, false]);
    expect(webGpuRenderer.dispose).toHaveBeenCalledTimes(1);
  });

  it("records a stalled background WebGPU qualification without delaying the cold WebGL2 boot", async () => {
    vi.useFakeTimers();
    const idle: Array<() => void> = [];
    const lane = webGpuLane();
    const webGlRenderer = Object.assign(createRendererSurface(), { init: vi.fn(async () => {}) });
    const webGpuRenderer = Object.assign(createRendererSurface(), {
      init: vi.fn(() => new Promise<void>(() => {})),
    });
    const createRenderer = vi.fn(async ({ forceWebGL }: { forceWebGL: boolean }) => ({
      activeMode: forceWebGL ? ("webgl2-fallback" as const) : ("webgpu" as const),
      renderer: forceWebGL ? webGlRenderer : webGpuRenderer,
    }));
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...lane,
        createRenderer,
        now: vi.fn(() => 0),
        resolveLaneStart: vi.fn(async () => ({
          fallbackReason: "webgpu-unproven" as const,
          forceWebGL: true,
          qualifyAtIdle: true,
          remembered: false,
        })),
        scheduleIdle: (work) => void idle.push(work),
      },
    );

    await expect(backend.initialize()).resolves.toEqual(expect.objectContaining({ activeMode: "webgl2-fallback" }));
    idle[0]();
    await vi.advanceTimersByTimeAsync(3_000);

    expect(lane.rememberLane).toHaveBeenCalledWith("webgl2", "idle:webgpu-init-timeout");
    expect(webGpuRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(backend.renderer).toBe(webGlRenderer);
    vi.useRealTimers();
  });

  it("builds the WebGPU backend when the probe found an adapter and remembers the lane that started", async () => {
    const lane = webGpuLane();
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
        ...lane,
        now: vi.fn(() => 0),
      },
    );

    const diagnostics = await backend.initialize();

    expect(threeWebGpuMock.rendererParameters).toEqual([{ forceWebGL: false }]);
    expect(diagnostics).toEqual(expect.objectContaining({ activeMode: "webgpu", fallbackReason: null }));
    expect(lane.rememberLane).toHaveBeenCalledWith("webgpu", "init");
  });

  it("times out the WebGPU backend when renderer creation never resolves", async () => {
    vi.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
        createRenderer: vi.fn(
          ({ signal }: { signal: AbortSignal }) =>
            new Promise<never>(() => {
              receivedSignal = signal;
            }),
        ),
        now: vi.fn().mockReturnValueOnce(0).mockReturnValue(15_000),
      },
    );

    const initPromise = backend.initialize();
    const initExpectation = expect(initPromise).rejects.toThrow(RendererInitTimeoutError);
    await vi.advanceTimersByTimeAsync(15_000);

    await initExpectation;
    expect(receivedSignal?.aborted).toBe(true);
    expect(snapshotRendererStartupTimings()).toEqual({
      "webgpu-backend-total": 15000,
    });
    vi.useRealTimers();
  });

  it("disposes a renderer that resolves after the total startup timeout", async () => {
    vi.useFakeTimers();
    const renderer = Object.assign(createRendererSurface(), {
      init: vi.fn(async () => {}),
    });
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
        createRenderer: vi.fn(
          ({ signal }: { signal: AbortSignal }) =>
            new Promise<{ activeMode: "webgpu"; renderer: typeof renderer }>((resolve) => {
              setTimeout(() => {
                expect(signal.aborted).toBe(true);
                resolve({
                  activeMode: "webgpu" as const,
                  renderer,
                });
              }, 15_100);
            }),
        ),
        now: vi
          .fn(() => 0)
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(15_000),
      },
    );

    const initPromise = backend.initialize();
    const initExpectation = expect(initPromise).rejects.toThrow(RendererInitTimeoutError);
    await vi.advanceTimersByTimeAsync(15_000);
    await initExpectation;
    await vi.advanceTimersByTimeAsync(100);

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("attaches device-loss diagnostics to the real device created during renderer initialization", async () => {
    let resolveLost: ((value: { message: string }) => void) | undefined;
    const onDeviceLost = vi.fn();
    const device = Object.assign(new EventTarget(), {
      lost: new Promise<{ message: string }>((resolve) => {
        resolveLost = resolve;
      }),
    });
    const renderer = Object.assign(createRendererSurface(), {
      backend: { device: undefined as typeof device | undefined },
      init: vi.fn(async () => {
        renderer.backend.device = device;
      }),
    });
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        onDeviceLost,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
        createRenderer: vi.fn(async () => ({
          activeMode: "webgpu" as const,
          renderer,
        })),
        now: vi
          .fn(() => 10)
          .mockReturnValueOnce(10)
          .mockReturnValueOnce(15),
      },
    );

    syncRendererBackendDiagnostics(await backend.initialize());
    expect(snapshotRendererDiagnostics().activeMode).toBe("webgpu");
    expect(snapshotRendererDiagnostics().gpuTelemetry.deviceStatus).toBe("ready");

    const uncapturedError = new Event("uncapturederror");
    Object.defineProperty(uncapturedError, "error", { value: { message: "validation failed" } });
    device.dispatchEvent(uncapturedError);
    expect(snapshotRendererDiagnostics().gpuTelemetry).toMatchObject({
      lastUncapturedErrorMessage: "validation failed",
      uncapturedErrorCount: 1,
    });

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
    expect(onDeviceLost).toHaveBeenCalledWith({
      activeMode: "webgpu",
      message: "device lost during frame",
    });
  });

  it("boots the automatic lane and reports native webgpu", async () => {
    const renderer = createRendererSurface();
    const init = vi.fn(async () => {});
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1.5,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
        createRenderer: vi.fn(async ({ forceWebGL }) => ({
          activeMode: forceWebGL ? ("webgl2-fallback" as const) : ("webgpu" as const),
          renderer: Object.assign(renderer, { init }),
        })),
        now: vi
          .fn()
          .mockReturnValueOnce(100)
          .mockReturnValueOnce(110)
          .mockReturnValueOnce(120)
          .mockReturnValueOnce(124)
          .mockReturnValue(124),
      },
    );

    const diagnostics = await backend.initialize();

    expect(init).toHaveBeenCalledTimes(1);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5);
    expect(renderer.setSize).toHaveBeenCalledWith(window.innerWidth, window.innerHeight);
    expect(diagnostics).toEqual({
      activeMode: "webgpu",
      buildMode: "webgpu-auto",
      fallbackReason: null,
      initTimeMs: 24,
      requestedMode: "webgpu-auto",
    });
  });

  it("uses the forced webgl fallback lane when requested", async () => {
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-force-webgl",
      },
      {
        ...webGpuLane(),
        createRenderer: vi.fn(async ({ forceWebGL }) => ({
          activeMode: forceWebGL ? ("webgl2-fallback" as const) : ("webgpu" as const),
          renderer: Object.assign(createRendererSurface(), {
            init: vi.fn(async () => {}),
          }),
        })),
        now: vi
          .fn(() => 50)
          .mockReturnValueOnce(50)
          .mockReturnValueOnce(55),
      },
    );

    const diagnostics = await backend.initialize();

    expect(diagnostics.activeMode).toBe("webgl2-fallback");
    expect(diagnostics.requestedMode).toBe("webgpu-force-webgl");
  });

  it("reports when automatic selection uses WebGL2 because WebGPU is unavailable", async () => {
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
        createRenderer: vi.fn(async () => ({
          activeMode: "webgl2-fallback" as const,
          fallbackReason: "webgpu-unavailable" as const,
          renderer: Object.assign(createRendererSurface(), {
            init: vi.fn(async () => {}),
          }),
        })),
        now: vi.fn(() => 50),
      },
    );

    await expect(backend.initialize()).resolves.toEqual(
      expect.objectContaining({
        activeMode: "webgl2-fallback",
        fallbackReason: "webgpu-unavailable",
      }),
    );
  });

  it("applies renderer-supported tone mapping controls directly when the native runtime is disabled", async () => {
    const renderer = createRendererSurface();
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
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

    expect(renderer.toneMapping).toBe(NeutralToneMapping);
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
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
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

    backend.applyRenderVisuals?.({
      pixelRatio: 1.5,
      shadows: true,
      width: 640,
      height: 360,
    });
    backend.resize?.(800, 450);
    const overlayScene = createRenderableOverlayScene("overlay-scene");
    backend.renderFrame?.({
      mainCamera: { id: "main-camera" } as never,
      mainScene: { id: "main-scene" } as never,
      overlayPasses: [
        {
          camera: { id: "overlay-camera" } as never,
          scene: overlayScene as never,
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

  it("recovers from a transient webgpu depth texture frame failure by resizing and retrying once", async () => {
    const renderer = createRendererSurface();
    renderer.render = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new TypeError("Cannot read properties of null (reading 'depthTexture')");
      })
      .mockImplementation(() => {});
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
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

    expect(() =>
      backend.renderFrame?.({
        mainCamera: { id: "main-camera" } as never,
        mainScene: { id: "main-scene" } as never,
      }),
    ).not.toThrow();

    expect(renderer.setSize).toHaveBeenCalledWith(window.innerWidth, window.innerHeight);
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it("resolves neutral tone mapping to NeutralToneMapping, distinct from aces-filmic", async () => {
    const renderer = createRendererSurface();
    const backend = createWebGPURendererBackend(
      {
        isMobileDevice: false,
        pixelRatio: 1,
        requestedMode: "webgpu-auto",
      },
      {
        ...webGpuLane(),
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
      bloom: { enabled: false, intensity: 0 },
      chromaticAberration: { enabled: false },
      colorGrade: { brightness: 0, contrast: 0, hue: 0, saturation: 0 },
      toneMapping: { exposure: 1, mode: "neutral", whitePoint: 1 },
      vignette: { darkness: 0, enabled: false, offset: 0 },
    });

    expect(renderer.toneMapping).toBe(NeutralToneMapping);
    expect(renderer.toneMapping).not.toBe(ACESFilmicToneMapping);

    backend.applyPostProcessPlan?.({
      antiAlias: "none",
      bloom: { enabled: false, intensity: 0 },
      chromaticAberration: { enabled: false },
      colorGrade: { brightness: 0, contrast: 0, hue: 0, saturation: 0 },
      toneMapping: { exposure: 1, mode: "aces-filmic", whitePoint: 1 },
      vignette: { darkness: 0, enabled: false, offset: 0 },
    });

    expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
  });
});
