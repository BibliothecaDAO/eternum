// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discardGpuBackendFrame, startGpuBackendFrame } from "./gpu-backend-hot-path-instrumentation";
import { syncRendererBackendDiagnostics } from "./renderer-diagnostics";
import { SceneName } from "./types";
import { createGameRendererRuntimeHarness } from "./game-renderer.runtime-harness";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  setTags: vi.fn(),
}));

vi.mock("@sentry/react", () => ({
  captureException: sentry.captureException,
  getCurrentScope: () => ({ setTags: sentry.setTags }),
}));

vi.mock("@bibliothecadao/eternum", () => {
  const scalar = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      StructureProgress: {
        STAGE_1: 1,
        STAGE_2: 2,
        STAGE_3: 3,
      },
      FELT_CENTER: 0,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : scalar),
      has: () => true,
    },
  );
});

vi.mock("@bibliothecadao/types", () => {
  const enumProxy = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      TroopTier: { T1: "T1", T2: "T2", T3: "T3" },
      TroopType: { Knight: "Knight", Crossbowman: "Crossbowman", Paladin: "Paladin" },
      StructureType: { Realm: "Realm", Hyperstructure: "Hyperstructure", Bank: "Bank", FragmentMine: "FragmentMine" },
      ResourcesIds: { StaminaRelic1: 1, Copper: 2, ColdIron: 3 },
      BiomeType: enumProxy,
      BuildingType: enumProxy,
      RealmLevelNames: enumProxy,
      RealmLevels: enumProxy,
      ResourceMiningTypes: enumProxy,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : enumProxy),
      has: () => true,
    },
  );
});

vi.mock("@/three/scenes/worldmap", () => ({ default: class MockWorldmapScene {} }));
vi.mock("@/three/scenes/hexception", () => ({ default: class MockHexceptionScene {} }));
vi.mock("@/three/scenes/hud-scene", () => ({ default: class MockHUDScene {} }));
vi.mock("@/three/scenes/fast-travel", () => ({ default: class MockFastTravelScene {} }));
vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_ENABLE_MEMORY_MONITORING: false,
    VITE_PUBLIC_GRAPHICS_DEV: false,
    VITE_PUBLIC_RENDERER_BUILD_MODE: "webgpu-auto",
  },
}));
vi.mock("@/three/scenes/hexagon-scene", () => ({
  HexagonScene: class MockHexagonScene {},
  CameraView: {
    Close: 1,
    Medium: 2,
    Far: 3,
  },
}));

Object.defineProperty(navigator, "getBattery", {
  configurable: true,
  value: vi.fn(async () => ({ charging: true })),
});

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: vi.fn(() => "blob:mock"),
});

vi.stubGlobal("GPUShaderStage", {
  COMPUTE: 4,
  FRAGMENT: 2,
  VERTEX: 1,
});

const { default: GameRenderer } = await import("./game-renderer");

describe("GameRenderer runtime harness", () => {
  beforeEach(() => {
    discardGpuBackendFrame();
    sentry.captureException.mockReset();
    sentry.setTags.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("models cancellable fade-out completion", async () => {
    const harness = createGameRendererRuntimeHarness();

    const fadeOut = harness.transitionManager.fadeOut();
    harness.transitionManager.destroy();

    await expect(fadeOut).resolves.toBe(false);
    expect(harness.transitionManager.isActive()).toBe(false);
  });

  it("boots and renders the active scene through the backend", async () => {
    const harness = createGameRendererRuntimeHarness();
    const subject = Object.assign(Object.create(GameRenderer.prototype), harness.createSubject());
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);

    harness.sceneManager.switchScene(SceneName.WorldMap);
    await vi.waitFor(() => expect(harness.worldmapScene.activateInputSurface).toHaveBeenCalledTimes(1));
    subject.animate();

    expect(harness.worldmapScene.setup).toHaveBeenCalledTimes(1);
    expect(harness.backend.renderFrame).toHaveBeenCalledWith({
      mainCamera: subject.camera,
      mainScene: "worldmap-scene",
      overlayPasses: [
        {
          camera: subject.camera,
          name: "world-interaction",
          scene: "worldmap-interaction-overlay-scene",
        },
        {
          camera: "hud-camera",
          name: "hud",
          scene: "hud-scene",
        },
      ],
      sceneName: SceneName.WorldMap,
    });
  });

  it("reports a repeated frame failure once while rendering and scheduling continue", async () => {
    const harness = createGameRendererRuntimeHarness();
    const subject = Object.assign(Object.create(GameRenderer.prototype), harness.createSubject());
    const frameError = new RangeError("writeBuffer range is invalid");
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(console, "error").mockImplementation(() => {});
    subject.getTargetFps = vi.fn(() => null);
    harness.backend.renderFrame.mockImplementation(() => {
      throw frameError;
    });
    syncRendererBackendDiagnostics({
      activeMode: "webgpu",
      buildMode: "webgpu-auto",
      fallbackReason: null,
      initTimeMs: 0,
      requestedMode: "webgpu-auto",
    });

    harness.sceneManager.switchScene(SceneName.WorldMap);
    await vi.waitFor(() => expect(harness.worldmapScene.activateInputSurface).toHaveBeenCalledTimes(1));
    requestAnimationFrameSpy.mockClear();
    subject.animate();
    subject.animate();
    subject.animate();
    subject.animate();

    expect(harness.backend.renderFrame).toHaveBeenCalledTimes(4);
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(4);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(
      frameError,
      expect.objectContaining({
        tags: {
          "renderer.backend": "webgpu",
          "renderer.failure_kind": "frame_error",
          "renderer.scene": SceneName.WorldMap,
        },
      }),
    );
  });

  it("reports first, repeated, and post-fallback device losses before recovery eligibility is applied", () => {
    const harness = createGameRendererRuntimeHarness();
    const subject = Object.assign(Object.create(GameRenderer.prototype), harness.createSubject());
    const recoverFromRendererDeviceLoss = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    subject.recoverFromRendererDeviceLoss = recoverFromRendererDeviceLoss;
    subject.hasRecoveredFromDeviceLoss = false;
    subject.isRecoveringFromDeviceLoss = false;

    subject.handleRendererDeviceLost({ activeMode: "webgpu", message: "first loss" });
    subject.isRecoveringFromDeviceLoss = true;
    subject.handleRendererDeviceLost({ activeMode: "webgpu", message: "repeated loss" });
    subject.isRecoveringFromDeviceLoss = false;
    subject.hasRecoveredFromDeviceLoss = true;
    subject.handleRendererDeviceLost({ activeMode: "webgl2-fallback", message: "fallback context lost" });

    expect(sentry.captureException).toHaveBeenCalledTimes(3);
    expect(recoverFromRendererDeviceLoss).toHaveBeenCalledTimes(3);
    expect(subject.hasRendererDeviceLossOccurred).toBe(true);
    expect(
      sentry.captureException.mock.calls.map(([, context]) => context.tags["renderer.recovery_attempted"]),
    ).toEqual(["yes", "no", "no"]);
  });

  it("unpauses and restarts the animation loop when fallback initialization fails", () => {
    const harness = createGameRendererRuntimeHarness();
    const subject = Object.assign(Object.create(GameRenderer.prototype), harness.createSubject());
    const animate = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    subject.animate = animate;
    subject.isRecoveringFromDeviceLoss = true;
    subject.isRendererRecoveryPaused = true;
    subject.lastTime = 100;

    subject.handleDeviceLossFallbackFailure(new Error("fallback init failed"), "webgpu");

    expect(subject.isRecoveringFromDeviceLoss).toBe(false);
    expect(subject.isRendererRecoveryPaused).toBe(false);
    expect(subject.lastTime).toBe(0);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: {
          "renderer.backend": "webgpu",
          "renderer.failure_kind": "recovery_failed",
        },
      }),
    );
  });

  it("switches scenes through the shared scene manager", async () => {
    const harness = createGameRendererRuntimeHarness();

    harness.sceneManager.switchScene(SceneName.WorldMap);
    await vi.waitFor(() => expect(harness.worldmapScene.activateInputSurface).toHaveBeenCalledTimes(1));
    harness.sceneManager.switchScene(SceneName.Hexception);
    await vi.waitFor(() => expect(harness.hexceptionScene.activateInputSurface).toHaveBeenCalledTimes(1));

    expect(harness.worldmapScene.activateInputSurface).toHaveBeenCalledTimes(1);
    expect(harness.worldmapScene.deactivateInputSurface).toHaveBeenCalledTimes(1);
    expect(harness.hexceptionScene.activateInputSurface).toHaveBeenCalledTimes(1);
  });

  it("propagates resize through the backend", () => {
    const harness = createGameRendererRuntimeHarness();
    const subject = Object.assign(Object.create(GameRenderer.prototype), harness.createSubject());
    const container = document.createElement("div");
    container.id = "three-container";
    Object.defineProperty(container, "clientWidth", { configurable: true, value: 640 });
    Object.defineProperty(container, "clientHeight", { configurable: true, value: 360 });
    document.body.appendChild(container);
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
    subject.isMobileDevice = false;
    subject.resolvePixelRatio = GameRenderer.prototype.resolvePixelRatio.bind(subject);

    subject.onWindowResize();

    expect(harness.backend.resize).toHaveBeenCalledWith(640, 360);
  });

  it("destroys backend, transition manager, and scenes", () => {
    const harness = createGameRendererRuntimeHarness();
    const subject = Object.assign(Object.create(GameRenderer.prototype), harness.createSubject());
    const canvasParent = document.createElement("div");
    canvasParent.appendChild(harness.backend.renderer.domElement);
    document.body.appendChild(canvasParent);
    subject.transitionManager = harness.transitionManager;

    subject.destroy();

    expect(harness.backend.dispose).toHaveBeenCalledTimes(1);
    expect(harness.transitionManager.destroy).toHaveBeenCalledTimes(1);
    expect(harness.worldmapScene.destroy).toHaveBeenCalledTimes(1);
    expect(harness.hexceptionScene.destroy).toHaveBeenCalledTimes(1);
    expect(subject.isDestroyed).toBe(true);
  });

  it("destroys an in-flight scene candidate without revealing or switching it off afterward", async () => {
    const harness = createGameRendererRuntimeHarness();
    const subject = Object.assign(Object.create(GameRenderer.prototype), harness.createSubject());
    subject.transitionManager = harness.transitionManager;

    harness.sceneManager.switchScene(SceneName.WorldMap);
    subject.destroy();
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.worldmapScene.setup).toHaveBeenCalledOnce();
    expect(harness.worldmapScene.destroy).toHaveBeenCalledOnce();
    expect(harness.worldmapScene.onSwitchOff).not.toHaveBeenCalled();
    expect(harness.worldmapScene.activateInputSurface).not.toHaveBeenCalled();
    expect(harness.transitionManager.fadeIn).not.toHaveBeenCalled();
  });

  it("does not carry a frame sample through teardown or a queued final animation tick", () => {
    const harness = createGameRendererRuntimeHarness();
    const subject = Object.assign(Object.create(GameRenderer.prototype), harness.createSubject());
    const warn = vi.fn();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const performanceNow = vi.spyOn(performance, "now").mockReturnValue(0);
    subject.transitionManager = harness.transitionManager;

    startGpuBackendFrame({
      gpuAttributionEnabled: false,
      pageVisible: true,
      rendererMode: "webgpu",
      startedAt: 0,
      warn,
    });
    subject.destroy();
    startGpuBackendFrame({
      gpuAttributionEnabled: false,
      pageVisible: true,
      rendererMode: "webgpu",
      startedAt: 1_000,
      warn,
    });
    subject.animate();
    startGpuBackendFrame({
      gpuAttributionEnabled: false,
      pageVisible: true,
      rendererMode: "webgpu",
      startedAt: 1_040,
      warn,
    });

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "[FramePerf] spike renderer_mode=webgpu duration_ms=40 frame_owner=unattributed gpu_attribution=disabled",
    );
    discardGpuBackendFrame();
    consoleWarn.mockRestore();
    performanceNow.mockRestore();
  });
});
