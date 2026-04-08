import { describe, expect, it, vi } from "vitest";

const { createRendererSessionRuntime } = await import("./renderer-session-runtime");

describe("createRendererSessionRuntime", () => {
  it("creates the HUD scene through the provided factory", () => {
    const hudScene = { id: "hud" };
    const runtime = createRendererSessionRuntime({
      addWindowListener: vi.fn(),
      createHudScene: () => hudScene,
      ensureMonitoring: vi.fn(),
      ensureRoute: vi.fn(),
      getMonitoring: vi.fn(),
      windowResizeListener: vi.fn(),
    });

    expect(runtime.createHudScene()).toBe(hudScene);
  });

  it("initializes and forwards monitoring calls through the monitoring runtime", () => {
    const monitoringRuntime = {
      captureStatsSample: vi.fn(),
      exportStatsRecording: vi.fn(),
      initialize: vi.fn(),
      startStatsRecording: vi.fn(),
      stopStatsRecording: vi.fn(() => ["sample"]),
      updateStatsPanel: vi.fn(),
    };
    const runtime = createRendererSessionRuntime({
      addWindowListener: vi.fn(),
      createHudScene: vi.fn(),
      ensureMonitoring: vi.fn(() => monitoringRuntime as never),
      ensureRoute: vi.fn(),
      getMonitoring: vi.fn(() => monitoringRuntime as never),
      windowResizeListener: vi.fn(),
    });

    runtime.initializeMonitoring();
    runtime.startStatsRecording();
    runtime.captureStatsSample();
    expect(runtime.stopStatsRecording()).toEqual(["sample"]);
    runtime.exportStatsRecording();
    runtime.updateStatsPanel();

    expect(monitoringRuntime.initialize).toHaveBeenCalledTimes(1);
    expect(monitoringRuntime.startStatsRecording).toHaveBeenCalledTimes(1);
    expect(monitoringRuntime.captureStatsSample).toHaveBeenCalledTimes(1);
    expect(monitoringRuntime.exportStatsRecording).toHaveBeenCalledTimes(1);
    expect(monitoringRuntime.updateStatsPanel).toHaveBeenCalledTimes(1);
  });

  it("starts route listeners and syncs the route through the route runtime", () => {
    const routeRuntime = {
      start: vi.fn(),
      syncFromLocation: vi.fn(),
    };
    const addWindowListener = vi.fn();
    const windowResizeListener = vi.fn();
    const runtime = createRendererSessionRuntime({
      addWindowListener,
      createHudScene: vi.fn(),
      ensureMonitoring: vi.fn(),
      ensureRoute: vi.fn(() => routeRuntime as never),
      getMonitoring: vi.fn(),
      windowResizeListener,
    });

    runtime.startListeners();
    runtime.syncRouteFromLocation();

    expect(routeRuntime.start).toHaveBeenCalledTimes(1);
    expect(addWindowListener).toHaveBeenCalledWith("resize", windowResizeListener);
    expect(routeRuntime.syncFromLocation).toHaveBeenCalledTimes(1);
  });
});
