import { vi } from "vitest";
import { SceneManager } from "./scene-manager";
import { SceneName } from "./types";

function createFakeScene(name: string) {
  return {
    name,
    setup: vi.fn(async () => {}),
    onSwitchOff: vi.fn(),
    moveCameraToURLLocation: vi.fn(),
    activateInputSurface: vi.fn(),
    deactivateInputSurface: vi.fn(),
    update: vi.fn(),
    getScene: vi.fn(() => `${name}-scene`),
    getInteractionOverlayScene: vi.fn(() => `${name}-interaction-overlay-scene`),
    getCurrentCameraView: vi.fn(() => undefined),
    hasActiveLabelAnimations: vi.fn(() => false),
    setWeatherAtmosphereState: vi.fn(),
    applyQualityFeatures: vi.fn(),
    destroy: vi.fn(),
  };
}

export function createGameRendererRuntimeHarness() {
  const backend = {
    renderer: {
      domElement: document.createElement("canvas"),
      info: {
        render: { calls: 0, triangles: 0 },
        memory: { geometries: 0, textures: 0 },
        reset: vi.fn(),
      },
      dispose: vi.fn(),
      render: vi.fn(),
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      shadowMap: {
        enabled: true,
        type: 0,
      },
      toneMapping: 0,
      toneMappingExposure: 0,
      autoClear: false,
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

  const transitionManager = {
    fadeOut: vi.fn((callback: () => void | Promise<void>) => {
      void callback();
    }),
    fadeIn: vi.fn(),
    destroy: vi.fn(),
  };

  const sceneManager = new SceneManager(transitionManager as never);
  const worldmapScene = createFakeScene("worldmap");
  const hexceptionScene = createFakeScene("hexception");

  sceneManager.addScene(SceneName.WorldMap, worldmapScene as never);
  sceneManager.addScene(SceneName.Hexception, hexceptionScene as never);

  return {
    backend,
    transitionManager,
    sceneManager,
    worldmapScene,
    hexceptionScene,
    createSubject() {
      const controlBridge = {
        handleInteractionChange: vi.fn(),
        markLabelsDirty: vi.fn(),
        setupGuiControls: vi.fn(),
      };
      const effectsBridge = {
        applyEnvironment: vi.fn(),
        applyQualityFeatures: vi.fn(),
        dispose: vi.fn(),
        setupPostProcessingEffects: vi.fn(),
        subscribeToQualityController: vi.fn(),
        updateWeatherPostProcessing: vi.fn(),
      };
      const monitoringRuntime = {
        initialize: vi.fn(),
        updateStatsPanel: vi.fn(),
        startStatsRecording: vi.fn(),
        stopStatsRecording: vi.fn(() => []),
        captureStatsSample: vi.fn(),
        exportStatsRecording: vi.fn(),
        dispose: vi.fn(),
      };
      const routeRuntime = {
        start: vi.fn(),
        syncFromLocation: vi.fn(),
        dispose: vi.fn(),
      };

      return {
        backend,
        renderer: backend.renderer,
        camera: { aspect: 1, updateProjectionMatrix: vi.fn() },
        controlBridge,
        effectsBridge,
        monitoringRuntime,
        routeRuntime,
        labelRuntime: {
          dispose: vi.fn(),
          isReady: vi.fn(() => true),
          markDirty: vi.fn(),
          render: vi.fn(),
          resize: vi.fn(),
          shouldRender: vi.fn(() => false),
        },
        controls: { update: vi.fn(), dispose: vi.fn() },
        hudScene: {
          update: vi.fn(),
          getWeatherState: vi.fn(() => ({})),
          getScene: vi.fn(() => "hud-scene"),
          getCamera: vi.fn(() => "hud-camera"),
          hasActiveLabelAnimations: vi.fn(() => false),
          onWindowResize: vi.fn(),
          destroy: vi.fn(),
        },
        worldmapScene,
        hexceptionScene,
        fastTravelScene: undefined,
        sceneManager,
        captureStatsSample: vi.fn(),
        lastTime: performance.now() - 16,
        getTargetFPS: vi.fn(() => null),
        updateWeatherPostProcessing: vi.fn(),
        isDestroyed: false,
        cleanupIntervals: [],
        guiFolders: [],
        supportRuntimeRegistry: {
          ensureEffectsBridge: () => effectsBridge,
          ensureMonitoring: () => monitoringRuntime,
          ensureRoute: () => routeRuntime,
          getControlBridge: () => controlBridge,
          getEffectsBridge: () => effectsBridge,
          getMonitoring: () => monitoringRuntime,
          getRoute: () => routeRuntime,
        },
        handleURLChange: vi.fn(),
        handleWindowResize: vi.fn(),
      } as any;
    },
  };
}
