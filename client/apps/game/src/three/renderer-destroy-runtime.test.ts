import { beforeEach, describe, expect, it, vi } from "vitest";

const disposeRendererBackend = vi.fn();
const destroyTrackedGuiFolders = vi.fn();
const disposeContactShadowResources = vi.fn();

vi.mock("./renderer-backend-compat", () => ({
  disposeRendererBackend,
}));

vi.mock("./utils/gui-folder-lifecycle", () => ({
  destroyTrackedGuiFolders,
}));

vi.mock("./utils/contact-shadow", () => ({
  disposeContactShadowResources,
}));

const { destroyRendererRuntime } = await import("./renderer-destroy-runtime");

describe("destroyRendererRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cleans subscriptions, timers, scenes, listeners, and support runtimes", () => {
    const unsubscribeQualityController = vi.fn();
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const removeWindowListener = vi.fn();
    const removeChild = vi.fn();
    const cleanupIntervals = [setInterval(() => {}, 60_000), setInterval(() => {}, 60_000)];
    const interactionRuntime = { dispose: vi.fn() };
    const labelRuntime = { dispose: vi.fn() };
    const monitoringRuntime = { dispose: vi.fn() };
    const routeRuntime = { dispose: vi.fn() };
    const worldmapScene = { destroy: vi.fn() };
    const fastTravelScene = { destroy: vi.fn() };
    const hexceptionScene = { destroy: vi.fn() };
    const hudScene = { destroy: vi.fn() };
    const transitionManager = { destroy: vi.fn() };

    destroyRendererRuntime({
      backend: { dispose: vi.fn() } as never,
      cleanupIntervals,
      guiFolders: [{} as never],
      handleWindowResize: vi.fn(),
      interactionRuntime: interactionRuntime as never,
      labelRuntime: labelRuntime as never,
      monitoringRuntime: monitoringRuntime as never,
      removeWindowListener,
      renderer: {
        domElement: {
          parentElement: {
            removeChild,
          },
        },
      } as never,
      routeRuntime: routeRuntime as never,
      scenes: {
        fastTravelScene,
        hexceptionScene,
        hudScene,
        worldmapScene,
      },
      transitionManager,
      unsubscribeQualityController,
    });

    expect(unsubscribeQualityController).toHaveBeenCalledTimes(1);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    expect(cleanupIntervals).toEqual([]);
    expect(removeChild).toHaveBeenCalledTimes(1);
    expect(disposeRendererBackend).toHaveBeenCalledTimes(1);
    expect(worldmapScene.destroy).toHaveBeenCalledTimes(1);
    expect(fastTravelScene.destroy).toHaveBeenCalledTimes(1);
    expect(hexceptionScene.destroy).toHaveBeenCalledTimes(1);
    expect(hudScene.destroy).toHaveBeenCalledTimes(1);
    expect(interactionRuntime.dispose).toHaveBeenCalledTimes(1);
    expect(transitionManager.destroy).toHaveBeenCalledTimes(1);
    expect(destroyTrackedGuiFolders).toHaveBeenCalledWith([{}]);
    expect(removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(labelRuntime.dispose).toHaveBeenCalledTimes(1);
    expect(monitoringRuntime.dispose).toHaveBeenCalledTimes(1);
    expect(routeRuntime.dispose).toHaveBeenCalledTimes(1);
    expect(disposeContactShadowResources).toHaveBeenCalledTimes(1);
  });

  it("falls back to controls disposal when no interaction runtime is present", () => {
    const controls = { dispose: vi.fn() };

    destroyRendererRuntime({
      cleanupIntervals: [],
      controls: controls as never,
      guiFolders: [],
      handleWindowResize: vi.fn(),
      removeWindowListener: vi.fn(),
      scenes: {},
    });

    expect(controls.dispose).toHaveBeenCalledTimes(1);
  });
});
