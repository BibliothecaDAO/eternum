// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRendererDiagnostics, snapshotRendererDiagnostics } from "./renderer-diagnostics";
import { SceneName } from "./types";

vi.mock("@/three/scenes/hexagon-scene", () => ({
  CameraView: {
    Close: 1,
    Medium: 2,
    Far: 3,
  },
}));

const { runRendererFrame } = await import("./renderer-frame-runtime");

function createScene(name: string, view = 1) {
  return {
    getCurrentCameraView: vi.fn(() => view),
    getInteractionOverlayScene: vi.fn(() => `${name}-interaction-overlay`),
    getScene: vi.fn(() => `${name}-scene`),
    hasActiveLabelAnimations: vi.fn(() => false),
    setWeatherAtmosphereState: vi.fn(),
    update: vi.fn(),
  };
}

function createHudScene() {
  return {
    getCamera: vi.fn(() => "hud-camera"),
    getScene: vi.fn(() => "hud-scene"),
    getWeatherState: vi.fn(() => ({ weather: "rain" })),
    hasActiveLabelAnimations: vi.fn(() => false),
    update: vi.fn(),
  };
}

function createBackend() {
  return {
    renderFrame: vi.fn(),
    renderer: {
      clear: vi.fn(),
      info: { reset: vi.fn() },
      render: vi.fn(),
    },
  };
}

describe("runRendererFrame", () => {
  beforeEach(() => {
    resetRendererDiagnostics();
  });

  it("updates the hud and weather fanout before bailing when no scene is active", () => {
    const hudScene = createHudScene();
    const worldmapScene = createScene("worldmap");
    const fastTravelScene = createScene("travel");
    const hexceptionScene = createScene("hexception");
    const backend = createBackend();
    const labelRuntime = {
      render: vi.fn(),
      shouldRender: vi.fn(() => false),
    };
    const effectsBridgeRuntime = {
      updateWeatherPostProcessing: vi.fn(),
    };

    const rendered = runRendererFrame({
      backend: backend as never,
      camera: "camera" as never,
      captureStatsSample: vi.fn(),
      currentScene: undefined,
      currentTime: 100,
      cycleProgress: 0.25,
      deltaTime: 0.016,
      fastTravelScene: fastTravelScene as never,
      hexceptionScene: hexceptionScene as never,
      hudScene: hudScene as never,
      labelRuntime: labelRuntime as never,
      effectsBridgeRuntime,
      worldmapScene: worldmapScene as never,
    });

    expect(rendered).toBe(false);
    expect(hudScene.update).toHaveBeenCalledWith(0.016, 0.25);
    expect(worldmapScene.setWeatherAtmosphereState).toHaveBeenCalledWith({ weather: "rain" });
    expect(fastTravelScene.setWeatherAtmosphereState).toHaveBeenCalledWith({ weather: "rain" });
    expect(hexceptionScene.setWeatherAtmosphereState).toHaveBeenCalledWith({ weather: "rain" });
    expect(backend.renderFrame).not.toHaveBeenCalled();
    expect(labelRuntime.shouldRender).not.toHaveBeenCalled();
  });

  it("renders the world map frame through the backend-owned pipeline", () => {
    const hudScene = createHudScene();
    const worldmapScene = createScene("worldmap", 1);
    const hexceptionScene = createScene("hexception", 2);
    const backend = createBackend();
    const labelRuntime = {
      render: vi.fn(),
      shouldRender: vi.fn(() => true),
    };
    const captureStatsSample = vi.fn();
    const effectsBridgeRuntime = {
      updateWeatherPostProcessing: vi.fn(),
    };

    const rendered = runRendererFrame({
      backend: backend as never,
      camera: "camera" as never,
      captureStatsSample,
      currentScene: SceneName.WorldMap,
      currentTime: 120,
      cycleProgress: 0.5,
      deltaTime: 0.02,
      fastTravelScene: undefined,
      hexceptionScene: hexceptionScene as never,
      hudScene: hudScene as never,
      labelRuntime: labelRuntime as never,
      effectsBridgeRuntime,
      worldmapScene: worldmapScene as never,
    });

    expect(rendered).toBe(true);
    expect(worldmapScene.update).toHaveBeenCalledWith(0.02);
    expect(labelRuntime.shouldRender).toHaveBeenCalledWith({
      cadenceView: "close",
      labelsActive: false,
      now: 120,
    });
    expect(labelRuntime.render).toHaveBeenNthCalledWith(1, "worldmap-scene", "camera");
    expect(backend.renderFrame).toHaveBeenCalledWith({
      mainCamera: "camera",
      mainScene: "worldmap-scene",
      overlayPasses: [
        {
          camera: "camera",
          name: "world-interaction",
          scene: "worldmap-interaction-overlay",
        },
        {
          camera: "hud-camera",
          name: "hud",
          scene: "hud-scene",
        },
      ],
      sceneName: SceneName.WorldMap,
    });
    expect(labelRuntime.render).toHaveBeenNthCalledWith(2, "hud-scene", "hud-camera");
    expect(effectsBridgeRuntime.updateWeatherPostProcessing).toHaveBeenCalledTimes(1);
    expect(captureStatsSample).toHaveBeenCalledTimes(1);
    expect(snapshotRendererDiagnostics().sceneName).toBe(SceneName.WorldMap);
  });

  it("routes fast-travel rendering and label activity through the travel scene when available", () => {
    const hudScene = createHudScene();
    const worldmapScene = createScene("worldmap", 1);
    const fastTravelScene = createScene("travel", 3);
    fastTravelScene.hasActiveLabelAnimations.mockReturnValue(true);
    const hexceptionScene = createScene("hexception", 2);
    const backend = createBackend();
    const labelRuntime = {
      render: vi.fn(),
      shouldRender: vi.fn(() => false),
    };
    const effectsBridgeRuntime = {
      updateWeatherPostProcessing: vi.fn(),
    };

    runRendererFrame({
      backend: backend as never,
      camera: "camera" as never,
      captureStatsSample: vi.fn(),
      currentScene: SceneName.FastTravel,
      currentTime: 220,
      cycleProgress: 0.9,
      deltaTime: 0.05,
      fastTravelScene: fastTravelScene as never,
      hexceptionScene: hexceptionScene as never,
      hudScene: hudScene as never,
      labelRuntime: labelRuntime as never,
      effectsBridgeRuntime,
      worldmapScene: worldmapScene as never,
    });

    expect(fastTravelScene.update).toHaveBeenCalledWith(0.05);
    expect(hexceptionScene.update).not.toHaveBeenCalled();
    expect(labelRuntime.shouldRender).toHaveBeenCalledWith({
      cadenceView: "far",
      labelsActive: true,
      now: 220,
    });
    expect(backend.renderFrame).toHaveBeenCalledWith(
      expect.objectContaining({
        mainScene: "travel-scene",
        sceneName: SceneName.FastTravel,
      }),
    );
  });
});
