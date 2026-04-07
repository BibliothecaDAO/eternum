import { describe, expect, it, vi } from "vitest";

const runtimeAssemblyMocks = vi.hoisted(() => ({
  createRendererControlBridgeRuntime: vi.fn(() => ({ id: "control-bridge" })),
  createRendererEffectsRuntime: vi.fn(() => ({ id: "effects-runtime" })),
  createRendererEffectsBridgeRuntime: vi.fn(() => ({ id: "effects-bridge" })),
  createRendererMonitoringRuntime: vi.fn(() => ({ id: "monitoring-runtime" })),
  createRendererRouteRuntime: vi.fn(() => ({ id: "route-runtime" })),
  createRendererRuntimeAssembly: vi.fn(),
  HUDScene: vi.fn(function MockHUDScene(this: Record<string, unknown>, sceneManager: unknown, controls: unknown) {
    this.sceneManager = sceneManager;
    this.controls = controls;
  }),
  contactShadowMaterial: { opacity: 0.5 },
  qualityController: {
    addEventListener: vi.fn(() => vi.fn()),
    getFeatures: vi.fn(() => ({ bloom: true })),
  },
}));

vi.mock("./renderer-control-bridge-runtime", () => ({
  createRendererControlBridgeRuntime: runtimeAssemblyMocks.createRendererControlBridgeRuntime,
}));

vi.mock("./renderer-effects-bridge-runtime", () => ({
  createRendererEffectsBridgeRuntime: runtimeAssemblyMocks.createRendererEffectsBridgeRuntime,
}));

vi.mock("./renderer-effects-runtime", () => ({
  createRendererEffectsRuntime: runtimeAssemblyMocks.createRendererEffectsRuntime,
}));

vi.mock("./renderer-monitoring-runtime", () => ({
  createRendererMonitoringRuntime: runtimeAssemblyMocks.createRendererMonitoringRuntime,
}));

vi.mock("./renderer-route-runtime", () => ({
  createRendererRouteRuntime: runtimeAssemblyMocks.createRendererRouteRuntime,
}));

vi.mock("./renderer-runtime-assembly", () => ({
  createRendererRuntimeAssembly: runtimeAssemblyMocks.createRendererRuntimeAssembly,
}));

vi.mock("./utils/contact-shadow", () => ({
  getContactShadowResources: () => ({
    material: runtimeAssemblyMocks.contactShadowMaterial,
  }),
}));

vi.mock("./utils/quality-controller", () => ({
  qualityController: runtimeAssemblyMocks.qualityController,
}));

vi.mock("@/three/scenes/hud-scene", () => ({
  default: runtimeAssemblyMocks.HUDScene,
}));

const { createGameRendererRuntimeAssembly } = await import("./game-renderer-runtime-assembly");

describe("createGameRendererRuntimeAssembly", () => {
  it("builds support runtime factories around the current game renderer state", () => {
    const createFolder = vi.fn(() => ({ add: vi.fn(), close: vi.fn(), destroy: vi.fn() }));
    const addWindowListener = vi.fn();
    const assemblyResult = {
      sessionRuntime: { id: "session-runtime" },
      supportRuntimeRegistry: { id: "support-runtime-registry" },
    };
    const fakeWindow = { id: "window" } as unknown as Window;
    const runtimeState = {
      backend: { renderer: { toneMapping: 1, toneMappingExposure: 0.9 } },
      controls: { id: "controls" },
      fastTravelScene: { requestSceneRefresh: vi.fn() },
      hexceptionScene: { id: "hexception-scene" },
      hudScene: {
        getWeatherManager: vi.fn(() => ({
          getState: vi.fn(() => ({
            intensity: 0.8,
            stormIntensity: 0.3,
          })),
        })),
      },
      labelRuntime: { markDirty: vi.fn() },
      renderer: { toneMapping: 1, toneMappingExposure: 0.9 },
      sceneManager: {
        getCurrentScene: vi.fn(() => "world-map"),
        moveCameraForScene: vi.fn(),
        switchScene: vi.fn(),
      },
      transitionManager: { fadeIn: vi.fn() },
      worldmapScene: {
        changeCameraView: vi.fn(),
        moveCameraToColRow: vi.fn(),
        moveCameraToXYZ: vi.fn(),
      },
    };

    runtimeAssemblyMocks.createRendererRuntimeAssembly.mockImplementation((input) => {
      expect(input.addWindowListener).toBe(addWindowListener);
      expect(input.windowResizeListener).toBe(windowResizeListener);
      expect(input.createHudScene()).toMatchObject({
        controls: runtimeState.controls,
        sceneManager: runtimeState.sceneManager,
      });
      expect(input.createControlBridgeRuntime()).toEqual({ id: "control-bridge" });
      expect(input.createEffectsBridgeRuntime()).toEqual({ id: "effects-bridge" });
      expect(input.createMonitoringRuntime()).toEqual({ id: "monitoring-runtime" });
      expect(input.createRouteRuntime()).toEqual({ id: "route-runtime" });
      return assemblyResult as never;
    });

    const windowResizeListener = vi.fn();

    const result = createGameRendererRuntimeAssembly({
      addWindowListener,
      createFolder,
      fastTravelEnabled: () => true,
      graphicsSetting: "HIGH",
      isGraphicsDevEnabled: true,
      isMemoryMonitoringEnabled: false,
      isMobileDevice: false,
      rendererOwner: { id: "game-renderer" },
      resolvePixelRatio: (pixelRatio) => pixelRatio / 2,
      resolveRuntimeState: () => runtimeState as never,
      windowObject: fakeWindow,
      windowResizeListener,
    });

    const controlBridgeInput = runtimeAssemblyMocks.createRendererControlBridgeRuntime.mock.calls[0][0];
    expect(controlBridgeInput.fastTravelEnabled()).toBe(true);
    expect(controlBridgeInput.getCurrentScene()).toBe("world-map");
    expect(controlBridgeInput.getRenderer()).toBe(runtimeState.renderer);

    controlBridgeInput.markLabelsDirty();
    expect(runtimeState.labelRuntime.markDirty).toHaveBeenCalledTimes(1);

    const effectsBridgeInput = runtimeAssemblyMocks.createRendererEffectsBridgeRuntime.mock.calls[0][0];
    expect(effectsBridgeInput.createEffectsRuntime()).toEqual({ id: "effects-runtime" });
    expect(effectsBridgeInput.resolveWeatherState()).toEqual({
      intensity: 0.8,
      stormIntensity: 0.3,
    });

    expect(runtimeAssemblyMocks.createRendererEffectsRuntime).toHaveBeenCalledWith({
      backend: runtimeState.backend,
      createFolder,
      graphicsSetting: "HIGH",
      isMobileDevice: false,
      resolvePixelRatio: expect.any(Function),
      scenes: {
        fastTravelScene: runtimeState.fastTravelScene,
        hexceptionScene: runtimeState.hexceptionScene,
        worldmapScene: runtimeState.worldmapScene,
      },
    });
    expect(runtimeAssemblyMocks.qualityController.getFeatures).toHaveBeenCalledTimes(0);

    const monitoringInput = runtimeAssemblyMocks.createRendererMonitoringRuntime.mock.calls[0][0];
    expect(monitoringInput.renderer).toBe(runtimeState.renderer);
    expect(monitoringInput.rendererOwner).toEqual({ id: "game-renderer" });
    expect(monitoringInput.getSceneName()).toBe("world-map");
    expect(monitoringInput.debugWindow).toBe(fakeWindow);

    const routeInput = runtimeAssemblyMocks.createRendererRouteRuntime.mock.calls[0][0];
    expect(routeInput.fastTravelEnabled()).toBe(true);
    expect(routeInput.getCurrentScene()).toBe("world-map");
    expect(routeInput.hasFastTravelScene()).toBe(true);

    routeInput.markLabelsDirty();
    expect(runtimeState.labelRuntime.markDirty).toHaveBeenCalledTimes(2);

    expect(runtimeAssemblyMocks.HUDScene).toHaveBeenCalledWith(runtimeState.sceneManager, runtimeState.controls);
    expect(result).toBe(assemblyResult);
  });
});
