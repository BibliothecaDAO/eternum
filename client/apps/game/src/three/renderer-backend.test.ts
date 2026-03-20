import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/ui/config", () => ({
  GraphicsSettings: {
    LOW: "LOW",
  },
}));

vi.mock("three", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    PMREMGenerator: vi.fn(),
  };
});

vi.mock("three/examples/jsm/environments/RoomEnvironment.js", () => ({
  RoomEnvironment: vi.fn(),
}));

vi.mock("three/examples/jsm/loaders/RGBELoader.js", () => ({
  RGBELoader: vi.fn(),
}));

import { createWebGLRendererBackend, _resetHDRCache } from "./renderer-backend";
import type { RendererPostProcessController, RendererPostProcessPlan } from "./renderer-backend-v2";
import type { RendererEnvironmentTargets } from "./renderer-backend";
import { PMREMGenerator } from "three";

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

function createMockEnvironmentTargets(): RendererEnvironmentTargets {
  return {
    hexceptionScene: { setEnvironment: vi.fn() },
    worldmapScene: { setEnvironment: vi.fn() },
    fastTravelScene: { setEnvironment: vi.fn() },
    intensity: 1.0,
  };
}

function createMockRenderTarget(label?: string) {
  return {
    dispose: vi.fn(),
    texture: { name: label ?? "mock-texture" },
  };
}

function setupPMREMGeneratorMock(fallbackTarget: ReturnType<typeof createMockRenderTarget>) {
  const pmremInstance = {
    compileEquirectangularShader: vi.fn(),
    fromScene: vi.fn(() => fallbackTarget),
    fromEquirectangular: vi.fn(),
    dispose: vi.fn(),
  };
  vi.mocked(PMREMGenerator).mockImplementation(() => pmremInstance as never);
  return pmremInstance;
}

function createBackendWithDeps() {
  const renderer = createRendererSurface();
  const runtime = {
    dispose: vi.fn(),
    renderFrame: vi.fn(),
    setPlan: vi.fn(),
    setSize: vi.fn(),
  };
  const backend = createWebGLRendererBackend(
    {
      graphicsSetting: "HIGH" as never,
      isMobileDevice: false,
      pixelRatio: 1,
    },
    {
      createPostProcessRuntime: vi.fn(() => runtime),
      createRenderer: vi.fn(() => renderer as never),
    },
  );
  return { backend, renderer, runtime };
}

describe("Stage 1: GPU memory leak on HDR load error", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      innerHeight: 720,
      innerWidth: 1280,
    });
    _resetHDRCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Bug 1a: fallbackTarget disposal on HDR load error", () => {
    it("disposes fallbackTarget on backend dispose when HDR load fails", async () => {
      const fallbackTarget = createMockRenderTarget("fallback");
      const pmrem = setupPMREMGeneratorMock(fallbackTarget);

      const { backend } = createBackendWithDeps();

      // Make loadCachedEnvironmentMap reject by having the RGBE loader fail
      // We need to mock the private method. Since loadCachedEnvironmentMap creates
      // an RGBELoader internally, we mock it to reject.
      const { RGBELoader } = await import("three/examples/jsm/loaders/RGBELoader.js");
      vi.mocked(RGBELoader).mockImplementation(
        () =>
          ({
            load: (_url: string, _onLoad: unknown, _onProgress: unknown, onError: (err: Error) => void) => {
              onError(new Error("HDR load failed"));
            },
          }) as never,
      );

      const targets = createMockEnvironmentTargets();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await backend.applyEnvironment(targets);

      // fallbackTarget is now this.environmentTarget
      // pmremGenerator should still be disposed (regression guard)
      expect(pmrem.dispose).toHaveBeenCalledTimes(1);

      // Now dispose backend — fallbackTarget should be disposed
      backend.dispose();
      expect(fallbackTarget.dispose).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it("still disposes pmremGenerator when HDR load fails (regression guard)", async () => {
      const fallbackTarget = createMockRenderTarget("fallback");
      const pmrem = setupPMREMGeneratorMock(fallbackTarget);

      const { backend } = createBackendWithDeps();

      const { RGBELoader } = await import("three/examples/jsm/loaders/RGBELoader.js");
      vi.mocked(RGBELoader).mockImplementation(
        () =>
          ({
            load: (_url: string, _onLoad: unknown, _onProgress: unknown, onError: (err: Error) => void) => {
              onError(new Error("HDR load failed"));
            },
          }) as never,
      );

      const targets = createMockEnvironmentTargets();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await backend.applyEnvironment(targets);

      expect(pmrem.dispose).toHaveBeenCalledTimes(1);

      backend.dispose();
      consoleSpy.mockRestore();
    });
  });

  describe("Bug 1b: cachedHDRTarget cleared on owning backend dispose", () => {
    it("clears cachedHDRTarget when owning backend is disposed", async () => {
      const fallbackTarget = createMockRenderTarget("fallback");
      const hdrTarget = createMockRenderTarget("hdr");
      const pmrem = setupPMREMGeneratorMock(fallbackTarget);
      pmrem.fromEquirectangular.mockReturnValue(hdrTarget);

      const { backend } = createBackendWithDeps();

      const { RGBELoader } = await import("three/examples/jsm/loaders/RGBELoader.js");
      vi.mocked(RGBELoader).mockImplementation(
        () =>
          ({
            load: (
              _url: string,
              onLoad: (texture: { dispose: () => void }) => void,
              _onProgress: unknown,
              _onError: unknown,
            ) => {
              onLoad({ dispose: vi.fn() });
            },
          }) as never,
      );

      const targets = createMockEnvironmentTargets();
      await backend.applyEnvironment(targets);

      // HDR loaded successfully, cachedHDRTarget is set internally.
      // Now dispose — cachedHDRTarget should be cleared so second backend gets fresh load.
      backend.dispose();

      // Create a second backend and verify it does a fresh load (not cached)
      const fallbackTarget2 = createMockRenderTarget("fallback2");
      const hdrTarget2 = createMockRenderTarget("hdr2");
      const pmrem2 = setupPMREMGeneratorMock(fallbackTarget2);
      pmrem2.fromEquirectangular.mockReturnValue(hdrTarget2);

      const { backend: backend2 } = createBackendWithDeps();
      const targets2 = createMockEnvironmentTargets();
      await backend2.applyEnvironment(targets2);

      // The second backend should have triggered a fresh HDR load (fromEquirectangular called)
      expect(pmrem2.fromEquirectangular).toHaveBeenCalledTimes(1);

      backend2.dispose();
    });

    it("second backend does not reuse stale cachedHDRTarget from disposed first backend", async () => {
      const fallbackTarget = createMockRenderTarget("fallback");
      const hdrTarget = createMockRenderTarget("hdr");
      const pmrem = setupPMREMGeneratorMock(fallbackTarget);
      pmrem.fromEquirectangular.mockReturnValue(hdrTarget);

      const { backend: backend1 } = createBackendWithDeps();

      const { RGBELoader } = await import("three/examples/jsm/loaders/RGBELoader.js");
      vi.mocked(RGBELoader).mockImplementation(
        () =>
          ({
            load: (
              _url: string,
              onLoad: (texture: { dispose: () => void }) => void,
              _onProgress: unknown,
              _onError: unknown,
            ) => {
              onLoad({ dispose: vi.fn() });
            },
          }) as never,
      );

      const targets1 = createMockEnvironmentTargets();
      await backend1.applyEnvironment(targets1);

      // Dispose first backend — this should clear the module cache
      backend1.dispose();

      // The hdrTarget should NOT be reusable by a second backend
      // Verify it was disposed since the owning backend was disposed
      expect(hdrTarget.dispose).toHaveBeenCalledTimes(1);

      // Second backend should do a fresh load
      const fallbackTarget2 = createMockRenderTarget("fallback2");
      const hdrTarget2 = createMockRenderTarget("hdr2");
      const pmrem2 = setupPMREMGeneratorMock(fallbackTarget2);
      pmrem2.fromEquirectangular.mockReturnValue(hdrTarget2);

      const { backend: backend2 } = createBackendWithDeps();
      const targets2 = createMockEnvironmentTargets();
      await backend2.applyEnvironment(targets2);

      // Second backend should have loaded a fresh HDR (not reused the stale one)
      expect(pmrem2.fromEquirectangular).toHaveBeenCalledTimes(1);

      backend2.dispose();
    });
  });
});
