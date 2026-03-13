// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { default: GameRenderer } = await import("./game-renderer");

function createFakeBackend() {
  return {
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
  });

  it("initializes renderer state from a backend factory", () => {
    const backend = createFakeBackend();
    const subject = Object.create(GameRenderer.prototype) as any;
    subject.graphicsSetting = "HIGH";
    subject.isMobileDevice = false;
    subject.getTargetPixelRatio = vi.fn(() => 1);

    subject.initializeRendererBackend(() => backend);

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
      getCurrentCameraView: vi.fn(() => undefined),
      hasActiveLabelAnimations: vi.fn(() => false),
    };
    subject.fastTravelScene = undefined;
    subject.hexceptionScene = {
      update: vi.fn(),
      setWeatherAtmosphereState: vi.fn(),
      getScene: vi.fn(() => "hex-scene"),
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
      overlayCamera: "hud-camera",
      overlayScene: "hud-scene",
      sceneName: "map",
    });
    expect(requestAnimationFrameSpy).toHaveBeenCalled();
  });
});
