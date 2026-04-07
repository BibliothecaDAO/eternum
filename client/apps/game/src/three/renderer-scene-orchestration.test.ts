// @vitest-environment jsdom
import type { QualityFeatures } from "./utils/quality-controller";
import { describe, expect, it, vi } from "vitest";

const sceneBootstrapMocks = vi.hoisted(() => ({
  bootstrapRendererSceneRuntime: vi.fn(),
  createGameRendererSceneRegistry: vi.fn(),
}));

vi.mock("./renderer-scene-bootstrap", () => sceneBootstrapMocks);

const sceneBootstrapModule = await import("./renderer-scene-bootstrap");
const { prepareGameRendererScenes } = await import("./renderer-scene-orchestration");

describe("prepareGameRendererScenes", () => {
  it("creates the scene registry, assigns it, and boots scene effects through the bridge", () => {
    const registry = {
      fastTravelScene: { id: "travel" },
      hexceptionScene: { id: "hex" },
      sceneManager: { moveCameraForScene: vi.fn() },
      transitionManager: { id: "transition" },
      worldmapScene: { id: "map" },
    };
    const effectsBridgeRuntime = {
      applyEnvironment: vi.fn(),
      applyQualityFeatures: vi.fn(),
      setupPostProcessingEffects: vi.fn(),
      subscribeToQualityController: vi.fn(),
    };
    const applySceneRegistry = vi.fn();
    const renderer = { id: "renderer" };
    const warn = vi.fn();
    const qualityFeatures: QualityFeatures = {
      bloom: true,
      bloomIntensity: 0.4,
      chunkLoadRadius: 3,
      chromaticAberration: false,
      animationCullDistance: 140,
      animationFPS: 30,
      fxaa: true,
      labelRenderDistance: 200,
      maxVisibleArmies: 1000,
      maxVisibleLabels: 500,
      maxVisibleStructures: 500,
      morphAnimations: true,
      pixelRatio: 1.5,
      shadowMapSize: 2048,
      shadows: true,
      vignette: true,
    };

    (sceneBootstrapModule.createGameRendererSceneRegistry as any).mockReturnValue(registry);

    prepareGameRendererScenes({
      applySceneRegistry,
      controls: { id: "controls" } as never,
      dojo: { id: "dojo" } as never,
      effectsBridgeRuntime: effectsBridgeRuntime as never,
      fastTravelEnabled: true,
      inputSurface: document.createElement("canvas"),
      mouse: { id: "mouse" } as never,
      qualityFeatures,
      raycaster: { id: "raycaster" } as never,
      renderer: renderer as never,
      warn,
    });

    expect(sceneBootstrapModule.createGameRendererSceneRegistry).toHaveBeenCalledTimes(1);
    expect(applySceneRegistry).toHaveBeenCalledWith(registry);
    expect(sceneBootstrapModule.bootstrapRendererSceneRuntime).toHaveBeenCalledWith({
      effectsBridgeRuntime,
      fastTravelScene: registry.fastTravelScene,
      hexceptionScene: registry.hexceptionScene,
      qualityFeatures,
      renderer,
      sceneManager: registry.sceneManager,
      warn,
      worldmapScene: registry.worldmapScene,
    });
  });
});
