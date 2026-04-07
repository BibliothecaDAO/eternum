// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToneMappingMode } from "postprocessing";
import { resetRendererDiagnostics, snapshotRendererDiagnostics } from "./renderer-diagnostics";
import { createRendererBackendCapabilities } from "./renderer-backend-v2";

vi.mock("@/three/constants", () => ({
  POST_PROCESSING_CONFIG: {
    HIGH: {
      bloomIntensity: 0.4,
      brightness: 0.1,
      contrast: 0.2,
      hue: 0,
      saturation: 0.05,
      toneMapping: {
        exposure: 0.8,
        mode: 4,
        whitePoint: 1.1,
      },
      vignette: {
        darkness: 0.4,
        offset: 0.3,
      },
    },
    LOW: null,
    MID: {
      bloomIntensity: 0.2,
      brightness: 0,
      contrast: 0,
      hue: 0,
      saturation: 0,
      toneMapping: {
        exposure: 1,
        mode: 2,
        whitePoint: 1,
      },
      vignette: {
        darkness: 0.2,
        offset: 0.2,
      },
    },
  },
}));

vi.mock("@/ui/config", () => ({
  GraphicsSettings: {
    HIGH: "HIGH",
    LOW: "LOW",
    MID: "MID",
  },
}));

const { createRendererEffectsRuntime } = await import("./renderer-effects-runtime");

function createBackend() {
  return {
    applyEnvironment: vi.fn(async () => {}),
    applyPostProcessPlan: vi.fn(() => ({
      setColorGrade: vi.fn(),
      setVignette: vi.fn(),
    })),
    applyQuality: vi.fn(),
    capabilities: createRendererBackendCapabilities({
      supportsBloom: true,
      supportsChromaticAberration: true,
      supportsColorGrade: true,
      supportsEnvironmentIbl: true,
      supportsToneMappingControl: true,
      supportsVignette: true,
    }),
    renderer: {
      info: {
        memory: { geometries: 0, textures: 0 },
        render: { calls: 0, triangles: 0 },
        reset: vi.fn(),
      },
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      shadowMap: { enabled: true },
    },
  };
}

function createScenes() {
  return {
    fastTravelScene: { applyQualityFeatures: vi.fn(), setEnvironment: vi.fn() },
    hexceptionScene: { applyQualityFeatures: vi.fn(), setEnvironment: vi.fn() },
    worldmapScene: { applyQualityFeatures: vi.fn(), setEnvironment: vi.fn() },
  };
}

function createFolderFactory() {
  return vi.fn(() => ({
    add: vi.fn(() => ({
      name: vi.fn(() => ({
        onChange: vi.fn(),
      })),
      onChange: vi.fn(),
    })),
    close: vi.fn(),
  }));
}

describe("renderer effects runtime", () => {
  beforeEach(() => {
    resetRendererDiagnostics();
  });

  it("boots postprocess for supported graphics tiers and applies the backend plan", () => {
    const backend = createBackend();
    const scenes = createScenes();
    const runtime = createRendererEffectsRuntime({
      backend: backend as never,
      createFolder: createFolderFactory(),
      graphicsSetting: "HIGH",
      isMobileDevice: false,
      scenes: scenes as never,
    });

    runtime.setupPostProcessingEffects({
      bloom: true,
      bloomIntensity: 0.3,
      chromaticAberration: false,
      fxaa: true,
      pixelRatio: 1.5,
      shadows: true,
      vignette: true,
    });

    expect(backend.applyPostProcessPlan).toHaveBeenCalledTimes(1);
    expect(runtime.hasPostProcessing()).toBe(true);
  });

  it("applies environment and quality policies through the backend and scene surfaces", async () => {
    const backend = createBackend();
    const scenes = createScenes();
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
    const runtime = createRendererEffectsRuntime({
      backend: backend as never,
      createFolder: createFolderFactory(),
      graphicsSetting: "HIGH",
      isMobileDevice: false,
      scenes: scenes as never,
    });

    await runtime.applyEnvironment();
    runtime.applyQualityFeatures({
      bloom: false,
      bloomIntensity: 0,
      chromaticAberration: false,
      fxaa: false,
      pixelRatio: 1.5,
      shadows: true,
      vignette: false,
    });

    expect(backend.applyEnvironment).toHaveBeenCalledWith({
      fastTravelScene: scenes.fastTravelScene,
      hexceptionScene: scenes.hexceptionScene,
      intensity: 0.55,
      worldmapScene: scenes.worldmapScene,
    });
    expect(backend.applyQuality).toHaveBeenCalledWith({
      height: window.innerHeight,
      pixelRatio: 1.5,
      shadows: true,
      width: window.innerWidth,
    });
    expect(scenes.worldmapScene.applyQualityFeatures).toHaveBeenCalledTimes(1);
    expect(scenes.fastTravelScene.applyQualityFeatures).toHaveBeenCalledTimes(1);
    expect(scenes.hexceptionScene.applyQualityFeatures).toHaveBeenCalledTimes(1);
  });

  it("degrades environment and unsupported postprocess features explicitly", () => {
    const backend = createBackend();
    backend.capabilities = createRendererBackendCapabilities({
      supportsEnvironmentIbl: false,
      supportsToneMappingControl: true,
    });
    const runtime = createRendererEffectsRuntime({
      backend: backend as never,
      createFolder: createFolderFactory(),
      graphicsSetting: "HIGH",
      isMobileDevice: false,
      scenes: createScenes() as never,
    });

    runtime.setupPostProcessingEffects({
      bloom: true,
      bloomIntensity: 0.6,
      chromaticAberration: true,
      fxaa: true,
      pixelRatio: 1.5,
      shadows: true,
      vignette: true,
    });
    void runtime.applyEnvironment();

    expect(snapshotRendererDiagnostics().degradations).toEqual(
      expect.arrayContaining([
        { feature: "environmentIbl", reason: "unsupported-backend", detail: expect.any(String) },
      ]),
    );
  });

  it("updates weather-driven color grade through the active postprocess controller", () => {
    const backend = createBackend();
    const controller = {
      setColorGrade: vi.fn(),
      setVignette: vi.fn(),
    };
    backend.applyPostProcessPlan.mockReturnValue(controller);
    const runtime = createRendererEffectsRuntime({
      backend: backend as never,
      createFolder: createFolderFactory(),
      graphicsSetting: "HIGH",
      isMobileDevice: false,
      scenes: createScenes() as never,
    });

    runtime.setupPostProcessingEffects({
      bloom: true,
      bloomIntensity: 0.6,
      chromaticAberration: false,
      fxaa: true,
      pixelRatio: 1.5,
      shadows: true,
      vignette: true,
    });
    runtime.updateWeatherPostProcessing({
      intensity: 0.6,
      stormIntensity: 0.4,
    });

    expect(controller.setColorGrade).toHaveBeenCalledTimes(1);
    expect(controller.setVignette).toHaveBeenCalledTimes(1);
  });

  it("maps tone mapping modes into backend-neutral values", () => {
    const runtime = createRendererEffectsRuntime({
      backend: createBackend() as never,
      createFolder: createFolderFactory(),
      graphicsSetting: "HIGH",
      isMobileDevice: false,
      scenes: createScenes() as never,
    });

    expect(runtime.resolveRendererToneMappingMode(ToneMappingMode.ACES_FILMIC)).toBe("aces-filmic");
    expect(runtime.resolveRendererToneMappingMode(ToneMappingMode.LINEAR)).toBe("linear");
    expect(runtime.resolveRendererToneMappingMode(ToneMappingMode.NEUTRAL)).toBe("neutral");
    expect(runtime.resolveRendererToneMappingMode(ToneMappingMode.REINHARD)).toBe("reinhard");
    expect(runtime.resolveRendererToneMappingMode(ToneMappingMode.OPTIMIZED_CINEON)).toBe("cineon");
  });
});
