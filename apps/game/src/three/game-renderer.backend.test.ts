// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRendererDiagnostics } from "./renderer-diagnostics";
import { createRendererBackendCapabilities } from "./renderer-backend-v2";

const createWebGPURendererBackendMock = vi.fn();

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
    VITE_PUBLIC_RENDERER_BUILD_MODE: "webgpu-auto",
  },
}));
vi.mock("./webgpu-renderer-backend", () => ({ createWebGPURendererBackend: createWebGPURendererBackendMock }));
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

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: vi.fn(() => "blob:mock"),
});

vi.stubGlobal("GPUShaderStage", {
  COMPUTE: 4,
  FRAGMENT: 2,
  VERTEX: 1,
});

const { default: GameRenderer } = await import("./game-renderer");

function createFakeBackend() {
  const renderer = {
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
    extensions: {
      get: vi.fn(() => undefined),
      has: vi.fn(() => false),
    },
    render: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    shadowMap: {
      enabled: true,
      type: 1,
    },
    toneMapping: 1,
    toneMappingExposure: 0.8,
  };

  return {
    capabilities: createRendererBackendCapabilities({
      supportsBloom: true,
      supportsChromaticAberration: true,
      supportsColorGrade: true,
      supportsEnvironmentIbl: true,
      supportsToneMappingControl: true,
      supportsVignette: true,
    }),
    renderer,
    initialize: vi.fn(async () => ({
      activeMode: "webgl2-fallback",
      buildMode: "webgpu-force-webgl",
      fallbackReason: null,
      initTimeMs: 0,
      requestedMode: "webgpu-force-webgl",
    })),
    resize: vi.fn(),
    applyRenderVisuals: vi.fn(),
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
    createWebGPURendererBackendMock.mockReset();
    resetRendererDiagnostics();
  });

  it("initializes renderer state from a backend factory", async () => {
    const backend = createFakeBackend();
    const subject = Object.create(GameRenderer.prototype) as any;
    subject.isMobileDevice = false;
    subject.getTargetPixelRatio = vi.fn(() => 1);

    await subject.initializeRendererBackend(() => backend);

    expect(subject.backend).toBe(backend);
    expect(subject.renderer).toBe(backend.renderer);
  });

  it("boots the configured WebGPU renderer through the shared runtime", async () => {
    const backend = createFakeBackend();
    backend.initialize.mockResolvedValue({
      activeMode: "webgpu",
      buildMode: "webgpu-auto",
      fallbackReason: null,
      initTimeMs: 4,
      requestedMode: "webgpu-auto",
    });
    const subject = Object.create(GameRenderer.prototype) as any;
    subject.isMobileDevice = false;
    subject.getTargetPixelRatio = vi.fn(() => 1);

    createWebGPURendererBackendMock.mockReturnValue(backend);

    await subject.initializeRendererBackend();

    expect(createWebGPURendererBackendMock).toHaveBeenCalledWith({
      forceReprobe: false,
      isMobileDevice: false,
      onDeviceLost: expect.any(Function),
      pixelRatio: 1,
      requestedMode: "webgpu-auto",
    });
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
    subject.labelRuntime = { markDirty: vi.fn(), resize: vi.fn() };
    subject.hudScene = { onWindowResize: vi.fn() };
    subject.supportRuntimeRegistry = {
      getControlBridge: () => ({ markLabelsDirty: vi.fn() }),
    };

    subject.onWindowResize();

    expect(backend.resize).toHaveBeenCalledWith(320, 200);
    expect(subject.hudScene.onWindowResize).toHaveBeenCalledWith(320, 200);
    expect(subject.labelRuntime.resize).toHaveBeenCalledWith(320, 200);
  });

  it("uses the backend-owned frame pipeline during animate", () => {
    const backend = createFakeBackend();
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const subject = Object.create(GameRenderer.prototype) as any;

    subject.backend = backend;
    subject.renderer = backend.renderer;
    subject.isDestroyed = false;
    subject.labelRuntime = {
      isReady: vi.fn(() => true),
      render: vi.fn(),
      shouldRender: vi.fn(() => false),
    };
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
    subject.sessionRuntime = {
      captureStatsSample: vi.fn(),
      updateStatsPanel: vi.fn(),
    };
    subject.camera = "camera";
    subject.lastTime = performance.now() - 16;
    subject.getTargetFps = vi.fn(() => null);
    subject.updateWeatherPostProcessing = vi.fn();
    subject.supportRuntimeRegistry = {
      getEffectsBridge: vi.fn(() => undefined),
      getMonitoring: vi.fn(() => undefined),
    };

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

  it("reconnects the live renderer surface to the maintained WebGL2 backend after WebGPU device loss", async () => {
    const previousBackend = createFakeBackend();
    const fallbackBackend = createFakeBackend();
    previousBackend.renderer.domElement.id = "main-canvas";
    document.body.appendChild(previousBackend.renderer.domElement);

    const controls = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      listenToKeyEvents: vi.fn(),
    };
    const effectsBridge = {
      applyEnvironment: vi.fn(),
      applyRenderVisualProfile: vi.fn(),
      dispose: vi.fn(),
      setupPostProcessingEffects: vi.fn(),
      updateWeatherPostProcessing: vi.fn(),
    };
    const monitoringRuntime = { dispose: vi.fn(), initialize: vi.fn() };
    const subject = Object.create(GameRenderer.prototype) as any;

    subject.backend = previousBackend;
    subject.renderer = previousBackend.renderer;
    subject.controls = controls;
    subject.isMobileDevice = false;
    subject.isDestroyed = false;
    subject.getTargetPixelRatio = vi.fn(() => 1);
    subject.initializeDeviceLossFallbackBackend = vi.fn(async () => ({
      backend: fallbackBackend,
      renderer: fallbackBackend.renderer,
    }));
    subject.animate = vi.fn();
    subject.camera = { aspect: 0, updateProjectionMatrix: vi.fn() };
    subject.labelRuntime = { markDirty: vi.fn(), resize: vi.fn() };
    subject.hudScene = {
      getWeatherManager: vi.fn(() => ({ getState: vi.fn(() => ({ intensity: 0.2, stormIntensity: 0 })) })),
      onWindowResize: vi.fn(),
    };
    subject.sceneManager = {};
    subject.worldmapScene = { setInputSurface: vi.fn(), applyRenderVisualProfile: vi.fn() };
    subject.fastTravelScene = { setInputSurface: vi.fn(), applyRenderVisualProfile: vi.fn() };
    subject.hexceptionScene = { setInputSurface: vi.fn(), applyRenderVisualProfile: vi.fn() };
    subject.sessionRuntime = {
      initializeMonitoring: vi.fn(),
    };
    subject.supportRuntimeRegistry = {
      ensureEffectsBridge: vi.fn(() => effectsBridge),
      getControlBridge: vi.fn(() => ({ markLabelsDirty: vi.fn() })),
      getMonitoring: vi.fn(() => monitoringRuntime),
      resetEffectsBridge: vi.fn(),
      resetMonitoring: vi.fn(),
    };

    await subject.recoverFromRendererDeviceLoss({
      activeMode: "webgpu",
      message: "device lost during frame",
    });

    expect(subject.backend).toBe(fallbackBackend);
    expect(subject.renderer).toBe(fallbackBackend.renderer);
    expect(document.getElementById("main-canvas")).toBe(fallbackBackend.renderer.domElement);
    expect(controls.disconnect).toHaveBeenCalledTimes(1);
    expect(controls.connect).toHaveBeenCalledWith(fallbackBackend.renderer.domElement);
    expect(controls.listenToKeyEvents).toHaveBeenCalledWith(document.body);
    expect(subject.worldmapScene.setInputSurface).toHaveBeenCalledWith(fallbackBackend.renderer.domElement);
    expect(subject.fastTravelScene.setInputSurface).toHaveBeenCalledWith(fallbackBackend.renderer.domElement);
    expect(subject.hexceptionScene.setInputSurface).toHaveBeenCalledWith(fallbackBackend.renderer.domElement);
    expect(subject.supportRuntimeRegistry.resetEffectsBridge).toHaveBeenCalledTimes(1);
    expect(subject.supportRuntimeRegistry.resetMonitoring).toHaveBeenCalledTimes(1);
    expect(subject.sessionRuntime.initializeMonitoring).toHaveBeenCalledTimes(1);
    expect(effectsBridge.applyEnvironment).toHaveBeenCalledTimes(1);
    expect(effectsBridge.setupPostProcessingEffects).toHaveBeenCalledTimes(1);
    expect(effectsBridge.applyRenderVisualProfile).toHaveBeenCalledTimes(1);
    expect(effectsBridge.updateWeatherPostProcessing).toHaveBeenCalledTimes(1);
    expect(previousBackend.dispose).toHaveBeenCalledTimes(1);
    expect(fallbackBackend.resize).toHaveBeenCalledTimes(1);
    expect(subject.animate).toHaveBeenCalledTimes(1);
  });
});
