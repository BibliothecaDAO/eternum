// @vitest-environment jsdom
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
    const requestScenePrewarm = vi.fn();
    const qualityFeatures = {
      bloom: true,
      bloomIntensity: 0.4,
      chromaticAberration: false,
      fxaa: true,
      pixelRatio: 1.5,
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
      requestScenePrewarm,
    });

    expect(sceneBootstrapModule.createGameRendererSceneRegistry).toHaveBeenCalledTimes(1);
    expect(applySceneRegistry).toHaveBeenCalledWith(registry);
    expect(sceneBootstrapModule.bootstrapRendererSceneRuntime).toHaveBeenCalledWith({
      effectsBridgeRuntime,
      fastTravelScene: registry.fastTravelScene,
      hexceptionScene: registry.hexceptionScene,
      qualityFeatures,
      requestScenePrewarm,
      sceneManager: registry.sceneManager,
      worldmapScene: registry.worldmapScene,
    });
  });
});
