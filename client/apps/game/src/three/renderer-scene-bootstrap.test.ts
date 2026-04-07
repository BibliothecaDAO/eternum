// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("@/three/managers/transition-manager", () => ({
  TransitionManager: class MockTransitionManager {},
}));

vi.mock("@/three/scene-manager", () => ({
  SceneManager: class MockSceneManager {},
}));

vi.mock("@/three/scenes/fast-travel", () => ({
  default: class MockFastTravelScene {},
}));

vi.mock("@/three/scenes/hexception", () => ({
  default: class MockHexceptionScene {},
}));

vi.mock("@/three/scenes/worldmap", () => ({
  default: class MockWorldmapScene {},
}));

const { bootstrapRendererSceneRuntime, createRendererSceneRegistry } = await import("./renderer-scene-bootstrap");

function createScene(name: string) {
  return {
    name,
    setInputSurface: vi.fn(),
  };
}

describe("createRendererSceneRegistry", () => {
  it("creates and registers the mandatory scenes plus fast travel when enabled", () => {
    const transitionManager = { id: "transition" };
    const sceneManager = { addScene: vi.fn() };
    const hexceptionScene = createScene("hex");
    const worldmapScene = createScene("map");
    const fastTravelScene = createScene("travel");
    const surface = document.createElement("canvas");

    const registry = createRendererSceneRegistry({
      controls: { id: "controls" } as never,
      createFastTravelScene: vi.fn(() => fastTravelScene as never),
      createHexceptionScene: vi.fn(() => hexceptionScene as never),
      createSceneManager: vi.fn(() => sceneManager as never),
      createTransitionManager: vi.fn(() => transitionManager as never),
      createWorldmapScene: vi.fn(() => worldmapScene as never),
      dojo: { id: "dojo" } as never,
      fastTravelEnabled: true,
      inputSurface: surface,
      mouse: { id: "mouse" } as never,
      raycaster: { id: "raycaster" } as never,
    });

    expect(registry.transitionManager).toBe(transitionManager);
    expect(registry.sceneManager).toBe(sceneManager);
    expect(registry.fastTravelScene).toBe(fastTravelScene);
    expect(hexceptionScene.setInputSurface).toHaveBeenCalledWith(surface);
    expect(worldmapScene.setInputSurface).toHaveBeenCalledWith(surface);
    expect(fastTravelScene.setInputSurface).toHaveBeenCalledWith(surface);
    expect(sceneManager.addScene).toHaveBeenCalledTimes(3);
    expect(sceneManager.addScene).toHaveBeenNthCalledWith(1, "hex", hexceptionScene);
    expect(sceneManager.addScene).toHaveBeenNthCalledWith(2, "map", worldmapScene);
    expect(sceneManager.addScene).toHaveBeenNthCalledWith(3, "travel", fastTravelScene);
  });

  it("omits fast travel registration when the mode is disabled", () => {
    const sceneManager = { addScene: vi.fn() };
    const hexceptionScene = createScene("hex");
    const worldmapScene = createScene("map");

    const registry = createRendererSceneRegistry({
      controls: { id: "controls" } as never,
      createHexceptionScene: vi.fn(() => hexceptionScene as never),
      createSceneManager: vi.fn(() => sceneManager as never),
      createTransitionManager: vi.fn(() => ({ id: "transition" }) as never),
      createWorldmapScene: vi.fn(() => worldmapScene as never),
      dojo: { id: "dojo" } as never,
      fastTravelEnabled: false,
      inputSurface: document.createElement("canvas"),
      mouse: { id: "mouse" } as never,
      raycaster: { id: "raycaster" } as never,
    });

    expect(registry.fastTravelScene).toBeUndefined();
    expect(sceneManager.addScene).toHaveBeenCalledTimes(2);
  });
});

describe("bootstrapRendererSceneRuntime", () => {
  it("prewarms scenes and applies environment, postprocess, and quality policies in order", async () => {
    const requestScenePrewarm = vi.fn();
    const applyEnvironment = vi.fn();
    const setupPostProcessingEffects = vi.fn();
    const applyQualityFeatures = vi.fn();
    const subscribeToQualityController = vi.fn();
    const sceneManager = { moveCameraForScene: vi.fn() };
    const qualityFeatures = {
      bloom: true,
      bloomIntensity: 0.4,
      chromaticAberration: false,
      fxaa: true,
      pixelRatio: 1.5,
      shadows: true,
      vignette: true,
    };

    bootstrapRendererSceneRuntime({
      applyEnvironment,
      applyQualityFeatures,
      fastTravelScene: { id: "travel" } as never,
      hexceptionScene: { id: "hex" } as never,
      qualityFeatures,
      requestScenePrewarm,
      sceneManager: sceneManager as never,
      setupPostProcessingEffects,
      subscribeToQualityController,
      worldmapScene: { id: "map" } as never,
    });

    expect(requestScenePrewarm).toHaveBeenNthCalledWith(1, { id: "map" });
    expect(requestScenePrewarm).toHaveBeenNthCalledWith(2, { id: "hex" });
    expect(requestScenePrewarm).toHaveBeenNthCalledWith(3, { id: "travel" });
    expect(applyEnvironment).toHaveBeenCalledTimes(1);
    expect(setupPostProcessingEffects).toHaveBeenCalledTimes(1);
    expect(sceneManager.moveCameraForScene).toHaveBeenCalledTimes(1);
    expect(applyQualityFeatures).toHaveBeenCalledWith(qualityFeatures);
    expect(subscribeToQualityController).toHaveBeenCalledTimes(1);
  });
});
