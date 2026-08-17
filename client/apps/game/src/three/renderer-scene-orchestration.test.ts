// @vitest-environment jsdom
import type { RenderVisualProfile } from "./render-profile";
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
      applyRenderVisualProfile: vi.fn(),
      setupPostProcessingEffects: vi.fn(),
    };
    const applySceneRegistry = vi.fn();
    const renderVisuals: RenderVisualProfile = {
      bloom: true,
      bloomIntensity: 0.4,
      chromaticAberration: false,
      animationCullDistance: 140,
      animationFps: 30,
      fxaa: true,
      labelRenderDistance: 200,
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
      renderVisuals,
      raycaster: { id: "raycaster" } as never,
    });

    expect(sceneBootstrapModule.createGameRendererSceneRegistry).toHaveBeenCalledTimes(1);
    expect(applySceneRegistry).toHaveBeenCalledWith(registry);
    expect(sceneBootstrapModule.bootstrapRendererSceneRuntime).toHaveBeenCalledWith({
      effectsBridgeRuntime,
      renderVisuals,
      sceneManager: registry.sceneManager,
    });
  });
});
