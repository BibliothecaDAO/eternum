// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { SceneName } from "./types";
import { createGameRendererRuntimeHarness } from "./game-renderer.runtime-harness";

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

describe("GameRenderer runtime harness", () => {
  it("boots and renders the active scene through the backend", async () => {
    const harness = createGameRendererRuntimeHarness();
    const subject = Object.assign(Object.create(GameRenderer.prototype), harness.createSubject());

    harness.sceneManager.switchScene(SceneName.WorldMap);
    await Promise.resolve();
    subject.animate();

    expect(harness.worldmapScene.setup).toHaveBeenCalledTimes(1);
    expect(harness.backend.renderFrame).toHaveBeenCalledWith({
      mainCamera: subject.camera,
      mainScene: "worldmap-scene",
      overlayCamera: "hud-camera",
      overlayScene: "hud-scene",
      sceneName: SceneName.WorldMap,
    });
  });

  it("switches scenes through the shared scene manager", async () => {
    const harness = createGameRendererRuntimeHarness();

    harness.sceneManager.switchScene(SceneName.WorldMap);
    await Promise.resolve();
    harness.sceneManager.switchScene(SceneName.Hexception);
    await Promise.resolve();

    expect(harness.worldmapScene.activateInputSurface).toHaveBeenCalledTimes(1);
    expect(harness.worldmapScene.deactivateInputSurface).toHaveBeenCalledTimes(1);
    expect(harness.hexceptionScene.activateInputSurface).toHaveBeenCalledTimes(1);
  });

  it("propagates resize and quality changes through the backend", () => {
    const harness = createGameRendererRuntimeHarness();
    const subject = Object.assign(Object.create(GameRenderer.prototype), harness.createSubject());
    const container = document.createElement("div");
    container.id = "three-container";
    Object.defineProperty(container, "clientWidth", { configurable: true, value: 640 });
    Object.defineProperty(container, "clientHeight", { configurable: true, value: 360 });
    document.body.appendChild(container);
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
    subject.isMobileDevice = false;
    subject.graphicsSetting = "HIGH";
    subject.resolvePixelRatio = GameRenderer.prototype.resolvePixelRatio.bind(subject);
    subject.postProcessingConfig = undefined;
    subject.toneMappingEffect = undefined;

    subject.onWindowResize();
    subject.applyQualityFeatures({
      pixelRatio: 1.5,
      shadows: true,
      fxaa: false,
      bloom: false,
      bloomIntensity: 0,
      vignette: false,
      chromaticAberration: false,
    });

    expect(harness.backend.resize).toHaveBeenCalledWith(640, 360);
    expect(harness.backend.applyQuality).toHaveBeenCalledWith({
      height: window.innerHeight,
      pixelRatio: 1.5,
      shadows: true,
      width: window.innerWidth,
    });
  });

  it("destroys backend, transition manager, and scenes", () => {
    const harness = createGameRendererRuntimeHarness();
    const subject = Object.assign(Object.create(GameRenderer.prototype), harness.createSubject());
    const canvasParent = document.createElement("div");
    canvasParent.appendChild(harness.backend.renderer.domElement);
    document.body.appendChild(canvasParent);
    subject.transitionManager = harness.transitionManager;

    subject.destroy();

    expect(harness.backend.dispose).toHaveBeenCalledTimes(1);
    expect(harness.transitionManager.destroy).toHaveBeenCalledTimes(1);
    expect(harness.worldmapScene.destroy).toHaveBeenCalledTimes(1);
    expect(harness.hexceptionScene.destroy).toHaveBeenCalledTimes(1);
    expect(subject.isDestroyed).toBe(true);
  });
});
