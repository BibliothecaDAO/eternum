import { describe, expect, it, vi } from "vitest";

const { createRendererRuntimeAssembly } = await import("./renderer-runtime-assembly");

describe("createRendererRuntimeAssembly", () => {
  it("assembles the support registry and session runtime around shared runtime factories", () => {
    const controlBridge = { id: "control" };
    const effectsBridge = { id: "effects" };
    const monitoringRuntime = {
      initialize: vi.fn(),
      startStatsRecording: vi.fn(),
      stopStatsRecording: vi.fn(() => ["sample"]),
      captureStatsSample: vi.fn(),
      exportStatsRecording: vi.fn(),
      updateStatsPanel: vi.fn(),
    };
    const routeRuntime = {
      start: vi.fn(),
      syncFromLocation: vi.fn(),
    };
    const hudScene = { id: "hud" };
    const addWindowListener = vi.fn();
    const windowResizeListener = vi.fn();

    const assembly = createRendererRuntimeAssembly({
      addWindowListener,
      createControlBridgeRuntime: vi.fn(() => controlBridge as never),
      createEffectsBridgeRuntime: vi.fn(() => effectsBridge as never),
      createHudScene: vi.fn(() => hudScene),
      createMonitoringRuntime: vi.fn(() => monitoringRuntime as never),
      createRouteRuntime: vi.fn(() => routeRuntime as never),
      windowResizeListener,
    });

    expect(assembly.supportRuntimeRegistry.getControlBridge()).toBe(controlBridge);
    expect(assembly.sessionRuntime.createHudScene()).toBe(hudScene);

    assembly.sessionRuntime.initializeMonitoring();
    assembly.sessionRuntime.startStatsRecording();
    assembly.sessionRuntime.captureStatsSample();
    assembly.sessionRuntime.exportStatsRecording();
    assembly.sessionRuntime.updateStatsPanel();
    expect(assembly.sessionRuntime.stopStatsRecording()).toEqual(["sample"]);
    assembly.sessionRuntime.startListeners();
    assembly.sessionRuntime.syncRouteFromLocation();

    expect(monitoringRuntime.initialize).toHaveBeenCalledTimes(1);
    expect(monitoringRuntime.startStatsRecording).toHaveBeenCalledTimes(1);
    expect(monitoringRuntime.captureStatsSample).toHaveBeenCalledTimes(1);
    expect(monitoringRuntime.exportStatsRecording).toHaveBeenCalledTimes(1);
    expect(monitoringRuntime.updateStatsPanel).toHaveBeenCalledTimes(1);
    expect(routeRuntime.start).toHaveBeenCalledTimes(1);
    expect(routeRuntime.syncFromLocation).toHaveBeenCalledTimes(1);
    expect(addWindowListener).toHaveBeenCalledWith("resize", windowResizeListener);
  });
});
