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
    onFrameRendered: vi.fn(),
    setWeatherAtmosphereState: vi.fn(),
    setAnimationsPaused: vi.fn(),
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

  it("updates the hud before bailing when no scene is active", () => {
    const hudScene = createHudScene();
    const worldmapScene = createScene("worldmap");
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
      hexceptionScene: hexceptionScene as never,
      hudScene: hudScene as never,
      labelRuntime: labelRuntime as never,
      effectsBridgeRuntime,
      worldmapScene: worldmapScene as never,
    });

    expect(rendered).toBe(false);
    expect(hudScene.update).toHaveBeenCalledWith(0.016, 0.25);
    expect(worldmapScene.setWeatherAtmosphereState).not.toHaveBeenCalled();
    expect(hexceptionScene.setWeatherAtmosphereState).not.toHaveBeenCalled();
    expect(effectsBridgeRuntime.updateWeatherPostProcessing).not.toHaveBeenCalled();
    expect(backend.renderFrame).not.toHaveBeenCalled();
    expect(labelRuntime.shouldRender).not.toHaveBeenCalled();
  });

  it("keeps updating a preparing scene without drawing it, then resumes presentation when ready", () => {
    const local = { ...createScene("hexception"), isReadyToRender: vi.fn(() => false) };
    const backend = createBackend();
    const labelRuntime = { render: vi.fn(), shouldRender: vi.fn(() => true) };
    const input = {
      backend: backend as never,
      camera: "camera" as never,
      captureStatsSample: vi.fn(),
      currentScene: SceneName.Hexception,
      currentTime: 100,
      cycleProgress: 0.25,
      deltaTime: 0.016,
      hexceptionScene: local as never,
      hudScene: createHudScene() as never,
      labelRuntime: labelRuntime as never,
      worldmapScene: createScene("worldmap") as never,
    };

    expect(runRendererFrame(input)).toBe(false);
    expect(local.update).toHaveBeenCalledOnce();
    expect(local.setWeatherAtmosphereState).toHaveBeenCalledOnce();
    expect(backend.renderFrame).not.toHaveBeenCalled();
    expect(local.onFrameRendered).not.toHaveBeenCalled();
    expect(labelRuntime.shouldRender).not.toHaveBeenCalled();
    expect(input.captureStatsSample).not.toHaveBeenCalled();

    local.isReadyToRender.mockReturnValue(true);
    expect(runRendererFrame(input)).toBe(true);
    expect(backend.renderFrame).toHaveBeenCalledOnce();
    expect(local.onFrameRendered).toHaveBeenCalledOnce();
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
      hexceptionScene: hexceptionScene as never,
      hudScene: hudScene as never,
      labelRuntime: labelRuntime as never,
      effectsBridgeRuntime,
      now: () => 135,
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
    expect(worldmapScene.onFrameRendered).toHaveBeenCalledWith(135);
    expect(labelRuntime.render).toHaveBeenNthCalledWith(2, "hud-scene", "hud-camera");
    expect(effectsBridgeRuntime.updateWeatherPostProcessing).toHaveBeenCalledTimes(1);
    expect(captureStatsSample).toHaveBeenCalledTimes(1);
    expect(snapshotRendererDiagnostics().sceneName).toBe(SceneName.WorldMap);
  });

  it("does not publish a rendered-frame observation when the backend throws", () => {
    const hudScene = createHudScene();
    const worldmapScene = createScene("worldmap", 1);
    const hexceptionScene = createScene("hexception");
    const backend = createBackend();
    backend.renderFrame.mockImplementation(() => {
      throw new Error("render failed");
    });

    expect(() =>
      runRendererFrame({
        backend: backend as never,
        camera: "camera" as never,
        captureStatsSample: vi.fn(),
        currentScene: SceneName.WorldMap,
        currentTime: 100,
        cycleProgress: 0.25,
        deltaTime: 0.016,
        hexceptionScene: hexceptionScene as never,
        hudScene: hudScene as never,
        labelRuntime: { render: vi.fn(), shouldRender: vi.fn(() => false) } as never,
        worldmapScene: worldmapScene as never,
      }),
    ).toThrow("render failed");
    expect(worldmapScene.onFrameRendered).not.toHaveBeenCalled();
  });
});

it.each([SceneName.WorldMap, SceneName.Hexception])(
  "keeps inspection rendering while pausing animations in %s",
  (sceneName) => {
    const worldmapScene = createScene("world");
    const hexceptionScene = createScene("local");
    const hudScene = createHudScene();
    const backend = createBackend();
    const scene = sceneName === SceneName.WorldMap ? worldmapScene : hexceptionScene;
    runRendererFrame({
      backend: backend as never,
      camera: "camera" as never,
      captureStatsSample: vi.fn(),
      currentScene: sceneName,
      currentTime: 100,
      cycleProgress: 50,
      deltaTime: 0.016,
      animationsPaused: true,
      worldmapScene: worldmapScene as never,
      hexceptionScene: hexceptionScene as never,
      hudScene: hudScene as never,
      labelRuntime: { render: vi.fn(), shouldRender: () => true } as never,
    });
    expect(scene.setAnimationsPaused).toHaveBeenCalledWith(true);
    expect(scene.update).toHaveBeenCalledWith(0.016);
    expect(hudScene.update).not.toHaveBeenCalled();
    expect(backend.renderFrame).toHaveBeenCalledOnce();
  },
);
