// @vitest-environment jsdom
import { PerspectiveCamera, Scene as ThreeScene } from "three";
import { describe, expect, it, vi } from "vitest";

const requestRendererScenePrewarmMock = vi.fn();

function createScene(name: string) {
  return {
    name,
    setInputSurface: vi.fn(),
  };
}

function createPrewarmableScene() {
  const scene = new ThreeScene();
  const camera = new PerspectiveCamera();

  return {
    getCamera: vi.fn(() => camera),
    getScene: vi.fn(() => scene),
  };
}

const transitionManagerInstance = { id: "transition" };
const sceneManagerInstance = { addScene: vi.fn(), moveCameraForScene: vi.fn() };
const fastTravelSceneInstance = createScene("travel");
const hexceptionSceneInstance = createScene("hex");
const worldmapSceneInstance = createScene("map");

vi.mock("@/three/managers/transition-manager", () => ({
  TransitionManager: vi.fn(() => transitionManagerInstance),
}));

vi.mock("@/three/scene-manager", () => ({
  SceneManager: vi.fn(() => sceneManagerInstance),
}));

vi.mock("@/three/scenes/fast-travel", () => ({
  default: vi.fn(() => fastTravelSceneInstance),
}));

vi.mock("@/three/scenes/hexception", () => ({
  default: vi.fn(() => hexceptionSceneInstance),
}));

vi.mock("@/three/scenes/worldmap", () => ({
  default: vi.fn(() => worldmapSceneInstance),
}));

vi.mock("./webgpu-postprocess-policy", () => ({
  requestRendererScenePrewarm: requestRendererScenePrewarmMock,
}));

const { bootstrapRendererSceneRuntime, createGameRendererSceneRegistry, createRendererSceneRegistry } =
  await import("./renderer-scene-bootstrap");

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

describe("createGameRendererSceneRegistry", () => {
  it("assembles the concrete game scenes through the shared registry helper", () => {
    sceneManagerInstance.addScene.mockClear();
    hexceptionSceneInstance.setInputSurface.mockClear();
    worldmapSceneInstance.setInputSurface.mockClear();
    fastTravelSceneInstance.setInputSurface.mockClear();

    const registry = createGameRendererSceneRegistry({
      controls: { id: "controls" } as never,
      dojo: { id: "dojo" } as never,
      fastTravelEnabled: true,
      inputSurface: document.createElement("canvas"),
      mouse: { id: "mouse" } as never,
      raycaster: { id: "raycaster" } as never,
    });

    expect(registry.transitionManager).toBe(transitionManagerInstance);
    expect(registry.sceneManager).toBe(sceneManagerInstance);
    expect(registry.hexceptionScene).toBe(hexceptionSceneInstance);
    expect(registry.worldmapScene).toBe(worldmapSceneInstance);
    expect(registry.fastTravelScene).toBe(fastTravelSceneInstance);
    expect(sceneManagerInstance.addScene).toHaveBeenCalledTimes(3);
    expect(hexceptionSceneInstance.setInputSurface).toHaveBeenCalledTimes(1);
    expect(worldmapSceneInstance.setInputSurface).toHaveBeenCalledTimes(1);
    expect(fastTravelSceneInstance.setInputSurface).toHaveBeenCalledTimes(1);
  });
});

describe("bootstrapRendererSceneRuntime", () => {
  it("prewarms scenes and applies environment, postprocess, and quality policies in order", async () => {
    requestRendererScenePrewarmMock.mockReset();
    const effectsBridgeRuntime = {
      applyEnvironment: vi.fn(),
      applyQualityFeatures: vi.fn(),
      setupPostProcessingEffects: vi.fn(),
      subscribeToQualityController: vi.fn(),
    };
    const renderer = { id: "renderer" };
    const worldmapScene = createPrewarmableScene();
    const hexceptionScene = createPrewarmableScene();
    const fastTravelScene = createPrewarmableScene();
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
      effectsBridgeRuntime,
      fastTravelScene,
      hexceptionScene,
      qualityFeatures,
      renderer: renderer as never,
      sceneManager: sceneManager as never,
      warn: vi.fn(),
      worldmapScene,
    });

    expect(requestRendererScenePrewarmMock).toHaveBeenNthCalledWith(
      1,
      renderer,
      worldmapScene.getScene(),
      worldmapScene.getCamera(),
    );
    expect(requestRendererScenePrewarmMock).toHaveBeenNthCalledWith(
      2,
      renderer,
      hexceptionScene.getScene(),
      hexceptionScene.getCamera(),
    );
    expect(requestRendererScenePrewarmMock).toHaveBeenNthCalledWith(
      3,
      renderer,
      fastTravelScene.getScene(),
      fastTravelScene.getCamera(),
    );
    expect(effectsBridgeRuntime.applyEnvironment).toHaveBeenCalledTimes(1);
    expect(effectsBridgeRuntime.setupPostProcessingEffects).toHaveBeenCalledTimes(1);
    expect(sceneManager.moveCameraForScene).toHaveBeenCalledTimes(1);
    expect(effectsBridgeRuntime.applyQualityFeatures).toHaveBeenCalledWith(qualityFeatures);
    expect(effectsBridgeRuntime.subscribeToQualityController).toHaveBeenCalledTimes(1);
  });

  it("warns when scene prewarm fails", async () => {
    const error = new Error("compile failed");
    const warn = vi.fn();
    const worldmapScene = createPrewarmableScene();
    const hexceptionScene = createPrewarmableScene();
    requestRendererScenePrewarmMock.mockReset();
    requestRendererScenePrewarmMock.mockRejectedValueOnce(error);

    bootstrapRendererSceneRuntime({
      effectsBridgeRuntime: {
        applyEnvironment: vi.fn(),
        applyQualityFeatures: vi.fn(),
        setupPostProcessingEffects: vi.fn(),
        subscribeToQualityController: vi.fn(),
      },
      hexceptionScene,
      qualityFeatures: {
        bloom: false,
        bloomIntensity: 0,
        chromaticAberration: false,
        fxaa: false,
        pixelRatio: 1,
        shadows: true,
        vignette: false,
      },
      renderer: { id: "renderer" } as never,
      sceneManager: { moveCameraForScene: vi.fn() } as never,
      warn,
      worldmapScene,
    });

    await Promise.resolve();

    expect(warn).toHaveBeenCalledWith("GameRenderer: Scene prewarm failed", error);
  });
});
