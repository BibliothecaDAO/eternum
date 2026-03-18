// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToneMappingMode } from "postprocessing";
import { resetRendererDiagnostics, snapshotRendererDiagnostics } from "./renderer-diagnostics";
import { createRendererBackendCapabilities } from "./renderer-backend-v2";

const initializeSelectedRendererBackendMock = vi.fn();

vi.mock("@bibliothecadao/eternum", () => {
  const scalar = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      StructureProgress: {
        STAGE_1: 1,
        STAGE_2: 2,
        STAGE_3: 3,
      },
      FELT_CENTER: 0,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : scalar),
      has: () => true,
    },
  );
});

vi.mock("@bibliothecadao/types", () => {
  const enumProxy = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      TroopTier: { T1: "T1", T2: "T2", T3: "T3" },
      TroopType: { Knight: "Knight", Crossbowman: "Crossbowman", Paladin: "Paladin" },
      StructureType: { Realm: "Realm", Hyperstructure: "Hyperstructure", Bank: "Bank", FragmentMine: "FragmentMine" },
      ResourcesIds: { StaminaRelic1: 1, Copper: 2, ColdIron: 3 },
      BiomeType: enumProxy,
      BuildingType: enumProxy,
      RealmLevelNames: enumProxy,
      RealmLevels: enumProxy,
      ResourceMiningTypes: enumProxy,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : enumProxy),
      has: () => true,
    },
  );
});

vi.mock("@/three/scenes/worldmap", () => ({ default: class MockWorldmapScene {} }));
vi.mock("@/three/scenes/hexception", () => ({ default: class MockHexceptionScene {} }));
vi.mock("@/three/scenes/hud-scene", () => ({ default: class MockHUDScene {} }));
vi.mock("@/three/scenes/fast-travel", () => ({ default: class MockFastTravelScene {} }));
vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_ENABLE_MEMORY_MONITORING: false,
    VITE_PUBLIC_GRAPHICS_DEV: false,
    VITE_PUBLIC_RENDERER_BUILD_MODE: "experimental-webgpu-auto",
  },
}));
vi.mock("./renderer-backend-loader", () => ({
  initializeSelectedRendererBackend: initializeSelectedRendererBackendMock,
}));
vi.mock("@/three/scenes/hexagon-scene", () => ({
  HexagonScene: class MockHexagonScene {},
  CameraView: {
    Close: 1,
    Medium: 2,
    Far: 3,
  },
}));

Object.defineProperty(navigator, "getBattery", {
  configurable: true,
  value: vi.fn(async () => ({ charging: true })),
});

vi.stubGlobal("GPUShaderStage", {
  COMPUTE: 4,
  FRAGMENT: 2,
  VERTEX: 1,
});

const { default: GameRenderer } = await import("./game-renderer");

function createFakeBackend() {
  return {
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
        render: { calls: 0, triangles: 0 },
        memory: { geometries: 0, textures: 0 },
        reset: vi.fn(),
      },
    },
    initialize: vi.fn(async () => ({
      activeMode: "legacy-webgl",
      buildMode: "legacy-webgl",
      fallbackReason: null,
      initTimeMs: 0,
      requestedMode: "legacy-webgl",
    })),
    resize: vi.fn(),
    applyQuality: vi.fn(),
    applyPostProcessPlan: vi.fn(() => ({
      setColorGrade: vi.fn(),
      setVignette: vi.fn(),
    })),
    applyEnvironment: vi.fn(async () => {}),
    renderFrame: vi.fn(),
    dispose: vi.fn(),
  };
}

describe("GameRenderer backend seam", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    initializeSelectedRendererBackendMock.mockReset();
    resetRendererDiagnostics();
  });

  it("initializes renderer state from a backend factory", async () => {
    const backend = createFakeBackend();
    const subject = Object.create(GameRenderer.prototype) as any;
    subject.graphicsSetting = "HIGH";
    subject.isMobileDevice = false;
    subject.getTargetPixelRatio = vi.fn(() => 1);

    await subject.initializeRendererBackend(() => backend);

    expect(subject.backend).toBe(backend);
    expect(subject.renderer).toBe(backend.renderer);
  });

  it("routes experimental env boot through the selected-backend loader", async () => {
    const backend = createFakeBackend();
    const diagnostics = {
      activeMode: "webgpu",
      buildMode: "experimental-webgpu-auto",
      fallbackReason: null,
      initTimeMs: 4,
      requestedMode: "experimental-webgpu-auto",
    } as const;
    const subject = Object.create(GameRenderer.prototype) as any;
    subject.graphicsSetting = "HIGH";
    subject.isMobileDevice = false;
    subject.getTargetPixelRatio = vi.fn(() => 1);

    initializeSelectedRendererBackendMock.mockResolvedValue({
      backend,
      diagnostics,
    });

    await subject.initializeRendererBackend();

    expect(initializeSelectedRendererBackendMock).toHaveBeenCalledTimes(1);
    expect(subject.backend).toBe(backend);
    expect(subject.renderer).toBe(backend.renderer);
  });

  it("propagates resize through the backend surface", () => {
    const backend = createFakeBackend();
    const container = document.createElement("div");
    container.id = "three-container";
    Object.defineProperty(container, "clientWidth", { configurable: true, value: 320 });
    Object.defineProperty(container, "clientHeight", { configurable: true, value: 200 });
    document.body.appendChild(container);

    const subject = Object.create(GameRenderer.prototype) as any;
    subject.backend = backend;
    subject.camera = { aspect: 0, updateProjectionMatrix: vi.fn() };
    subject.labelRenderer = { setSize: vi.fn() };
    subject.hudScene = { onWindowResize: vi.fn() };
    subject.labelsDirty = false;

    subject.onWindowResize();

    expect(backend.resize).toHaveBeenCalledWith(320, 200);
    expect(subject.hudScene.onWindowResize).toHaveBeenCalledWith(320, 200);
    expect(subject.labelRenderer.setSize).toHaveBeenCalledWith(320, 200);
  });

  it("delegates quality application through the backend", () => {
    const backend = createFakeBackend();
    const subject = Object.create(GameRenderer.prototype) as any;
    subject.backend = backend;
    subject.isMobileDevice = false;
    subject.graphicsSetting = "HIGH";
    subject.postProcessingConfig = undefined;
    subject.toneMappingEffect = undefined;
    subject.worldmapScene = { applyQualityFeatures: vi.fn() };
    subject.fastTravelScene = { applyQualityFeatures: vi.fn() };
    subject.hexceptionScene = { applyQualityFeatures: vi.fn() };
    subject.resolvePixelRatio = GameRenderer.prototype.resolvePixelRatio.bind(subject);
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });

    subject.applyQualityFeatures({
      pixelRatio: 1.5,
      shadows: true,
      fxaa: false,
      bloom: false,
      bloomIntensity: 0,
      vignette: false,
      chromaticAberration: false,
    });

    expect(backend.applyQuality).toHaveBeenCalledWith({
      height: window.innerHeight,
      pixelRatio: 1.5,
      shadows: true,
      width: window.innerWidth,
    });
  });


  it("disables unsupported optional effects before applying the backend plan and reports degradations", () => {
    const backend = createFakeBackend();
    backend.capabilities = createRendererBackendCapabilities({
      supportsEnvironmentIbl: false,
      supportsToneMappingControl: true,
    });

    const subject = Object.create(GameRenderer.prototype) as any;
    subject.backend = backend;
    subject.isMobileDevice = false;
    subject.graphicsSetting = "HIGH";
    subject.postProcessingConfig = {
      bloomIntensity: 0.25,
      brightness: 0,
      contrast: 0,
      hue: 0,
      saturation: 0.1,
      toneMapping: {
        exposure: 0.7,
        mode: ToneMappingMode.OPTIMIZED_CINEON,
        whitePoint: 1.2,
      },
      vignette: {
        darkness: 0.9,
        offset: 0.35,
      },
    };
    subject.resolvePixelRatio = GameRenderer.prototype.resolvePixelRatio.bind(subject);
    subject.resolveRendererToneMappingMode = GameRenderer.prototype.resolveRendererToneMappingMode.bind(subject);
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });

    subject.applyQualityFeatures({
      pixelRatio: 1.5,
      shadows: true,
      fxaa: true,
      bloom: true,
      bloomIntensity: 0.25,
      vignette: true,
      chromaticAberration: true,
    });

    expect(backend.applyPostProcessPlan).toHaveBeenCalledWith({
      antiAlias: "fxaa",
      bloom: {
        enabled: false,
        intensity: 0.25,
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
        exposure: 0.7,
        mode: "cineon",
        whitePoint: 1.2,
      },
      vignette: {
        darkness: 0.9,
        enabled: false,
        offset: 0.35,
      },
    });
    expect(snapshotRendererDiagnostics().degradations).toEqual([
      { feature: "colorGrade", reason: "unsupported-backend" },
      { feature: "bloom", reason: "unsupported-backend" },
      { feature: "vignette", reason: "unsupported-backend" },
      { feature: "chromaticAberration", reason: "unsupported-backend" },
    ]);
  });

  it("uses the backend-owned frame pipeline during animate", () => {
    const backend = createFakeBackend();
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const subject = Object.create(GameRenderer.prototype) as any;

    subject.backend = backend;
    subject.renderer = backend.renderer;
    subject.isDestroyed = false;
    subject.labelRenderer = { render: vi.fn() };
    subject.controls = { update: vi.fn() };
    subject.hudScene = {
      update: vi.fn(),
      getWeatherState: vi.fn(() => ({})),
      getScene: vi.fn(() => "hud-scene"),
      getCamera: vi.fn(() => "hud-camera"),
      hasActiveLabelAnimations: vi.fn(() => false),
    };
    subject.worldmapScene = {
      update: vi.fn(),
      setWeatherAtmosphereState: vi.fn(),
      getScene: vi.fn(() => "world-scene"),
      getInteractionOverlayScene: vi.fn(() => "world-interaction-overlay-scene"),
      getCurrentCameraView: vi.fn(() => undefined),
      hasActiveLabelAnimations: vi.fn(() => false),
    };
    subject.fastTravelScene = undefined;
    subject.hexceptionScene = {
      update: vi.fn(),
      setWeatherAtmosphereState: vi.fn(),
      getScene: vi.fn(() => "hex-scene"),
      getInteractionOverlayScene: vi.fn(() => "hex-interaction-overlay-scene"),
      getCurrentCameraView: vi.fn(() => undefined),
      hasActiveLabelAnimations: vi.fn(() => false),
    };
    subject.sceneManager = {
      getCurrentScene: vi.fn(() => "map"),
    };
    subject.camera = "camera";
    subject.shouldRenderLabels = vi.fn(() => false);
    subject.captureStatsSample = vi.fn();
    subject.lastTime = performance.now() - 16;
    subject.getTargetFPS = vi.fn(() => null);
    subject.updateWeatherPostProcessing = vi.fn();

    subject.animate();

    expect(backend.renderFrame).toHaveBeenCalledWith({
      mainCamera: "camera",
      mainScene: "world-scene",
      overlayPasses: [
        {
          camera: "camera",
          name: "world-interaction",
          scene: "world-interaction-overlay-scene",
        },
        {
          camera: "hud-camera",
          name: "hud",
          scene: "hud-scene",
        },
      ],
      sceneName: "map",
    });
    expect(requestAnimationFrameSpy).toHaveBeenCalled();
  });

  it("applies environment ibl with the graphics-tier intensity when the backend supports it", () => {
    const backend = createFakeBackend();
    const subject = Object.create(GameRenderer.prototype) as any;
    subject.backend = backend;
    subject.graphicsSetting = "HIGH";
    subject.worldmapScene = { setEnvironment: vi.fn() };
    subject.hexceptionScene = { setEnvironment: vi.fn() };
    subject.fastTravelScene = { setEnvironment: vi.fn() };

    subject.applyEnvironment();

    expect(backend.applyEnvironment).toHaveBeenCalledWith({
      fastTravelScene: subject.fastTravelScene,
      hexceptionScene: subject.hexceptionScene,
      intensity: 0.55,
      worldmapScene: subject.worldmapScene,
    });
    expect(snapshotRendererDiagnostics().degradations).toEqual([]);
  });

  it("reports explicit fallback lighting when environment ibl is unavailable", () => {
    const backend = createFakeBackend();
    backend.capabilities = createRendererBackendCapabilities({
      supportsToneMappingControl: true,
    });

    const subject = Object.create(GameRenderer.prototype) as any;
    subject.backend = backend;
    subject.graphicsSetting = "MID";
    subject.worldmapScene = { setEnvironment: vi.fn() };
    subject.hexceptionScene = { setEnvironment: vi.fn() };
    subject.fastTravelScene = { setEnvironment: vi.fn() };

    subject.applyEnvironment();

    expect(backend.applyEnvironment).not.toHaveBeenCalled();
    expect(snapshotRendererDiagnostics().degradations).toEqual([
      {
        detail: "Using scene key/fill fallback lighting policy at target environment intensity 0.45",
        feature: "environmentIbl",
        reason: "unsupported-backend",
      },
    ]);
  });
});
