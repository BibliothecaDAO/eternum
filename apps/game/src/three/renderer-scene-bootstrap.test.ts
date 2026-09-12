// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { SceneName } from "./types";

function createScene(name: string) {
  return {
    name,
    setInputSurface: vi.fn(),
  };
}

const transitionManagerInstance = { id: "transition" };
const sceneManagerInstance = { addScene: vi.fn(), moveCameraForScene: vi.fn() };
const hexceptionSceneInstance = createScene("hex");
const worldmapSceneInstance = createScene("map");

vi.mock("@/three/managers/transition-manager", () => ({
  TransitionManager: vi.fn(() => transitionManagerInstance),
}));

vi.mock("@/three/scene-manager", () => ({
  SceneManager: vi.fn(() => sceneManagerInstance),
}));

vi.mock("@/three/scenes/hexception", () => ({
  default: vi.fn(() => hexceptionSceneInstance),
}));

vi.mock("@/three/scenes/worldmap", () => ({
  default: vi.fn(() => worldmapSceneInstance),
}));

const { bootstrapRendererSceneRuntime, createGameRendererSceneRegistry } = await import("./renderer-scene-bootstrap");

describe("createGameRendererSceneRegistry", () => {
  it("assembles the concrete game scenes through the shared registry helper", () => {
    sceneManagerInstance.addScene.mockClear();
    hexceptionSceneInstance.setInputSurface.mockClear();
    worldmapSceneInstance.setInputSurface.mockClear();

    const registry = createGameRendererSceneRegistry({
      controls: { id: "controls" } as never,
      dojo: { id: "dojo" } as never,
      inputSurface: document.createElement("canvas"),
      mouse: { id: "mouse" } as never,
      raycaster: { id: "raycaster" } as never,
    });

    expect(registry.transitionManager).toBe(transitionManagerInstance);
    expect(registry.sceneManager).toBe(sceneManagerInstance);
    expect(registry.hexceptionScene).toBe(hexceptionSceneInstance);
    expect(registry.worldmapScene).toBe(worldmapSceneInstance);
    expect(sceneManagerInstance.addScene).toHaveBeenCalledTimes(2);
    expect(hexceptionSceneInstance.setInputSurface).toHaveBeenCalledTimes(1);
    expect(worldmapSceneInstance.setInputSurface).toHaveBeenCalledTimes(1);
  });
});

describe("bootstrapRendererSceneRuntime", () => {
  it("boots scene effects and applies the initial camera and visual profile", () => {
    const effectsBridgeRuntime = {
      applyEnvironment: vi.fn(),
      applyRenderVisualProfile: vi.fn(),
      setupPostProcessingEffects: vi.fn(),
    };
    const sceneManager = { moveCameraForScene: vi.fn() };
    const renderVisuals = {
      animationCullDistance: 120,
      animationFps: 24,
      bloom: true,
      bloomIntensity: 0.4,
      chromaticAberration: false,
      fxaa: true,
      labelRenderDistance: 160,
      pixelRatio: 1.5,
      shadowMapSize: 1024,
      shadows: true,
      vignette: true,
    };

    bootstrapRendererSceneRuntime({
      effectsBridgeRuntime,
      renderVisuals,
      sceneManager: sceneManager as never,
    });

    expect(effectsBridgeRuntime.applyEnvironment).toHaveBeenCalledTimes(1);
    expect(effectsBridgeRuntime.setupPostProcessingEffects).toHaveBeenCalledTimes(1);
    expect(sceneManager.moveCameraForScene).toHaveBeenCalledTimes(1);
    expect(effectsBridgeRuntime.applyRenderVisualProfile).toHaveBeenCalledWith(renderVisuals);
  });
});
