import { describe, expect, it, vi } from "vitest";

const { createRendererSupportRuntimeRegistry } = await import("./renderer-support-runtime-registry");

describe("createRendererSupportRuntimeRegistry", () => {
  it("creates the control bridge eagerly and lazily initializes the remaining runtimes", () => {
    const controlBridge = { id: "control" };
    const monitoringRuntime = { id: "monitoring" };
    const routeRuntime = { id: "route" };
    const effectsBridgeRuntime = { id: "effects" };
    const createControlBridgeRuntime = vi.fn(() => controlBridge as never);
    const createMonitoringRuntime = vi.fn(() => monitoringRuntime as never);
    const createRouteRuntime = vi.fn(() => routeRuntime as never);
    const createEffectsBridgeRuntime = vi.fn(() => effectsBridgeRuntime as never);

    const registry = createRendererSupportRuntimeRegistry({
      createControlBridgeRuntime,
      createEffectsBridgeRuntime,
      createMonitoringRuntime,
      createRouteRuntime,
    });

    expect(createControlBridgeRuntime).toHaveBeenCalledTimes(1);
    expect(createMonitoringRuntime).not.toHaveBeenCalled();
    expect(createRouteRuntime).not.toHaveBeenCalled();
    expect(createEffectsBridgeRuntime).not.toHaveBeenCalled();
    expect(registry.getControlBridge()).toBe(controlBridge);
    expect(registry.ensureMonitoring()).toBe(monitoringRuntime);
    expect(registry.ensureRoute()).toBe(routeRuntime);
    expect(registry.ensureEffectsBridge()).toBe(effectsBridgeRuntime);
  });

  it("reuses lazy runtimes after the first initialization", () => {
    const registry = createRendererSupportRuntimeRegistry({
      createControlBridgeRuntime: vi.fn(() => ({}) as never),
      createEffectsBridgeRuntime: vi.fn(() => ({ id: "effects" }) as never),
      createMonitoringRuntime: vi.fn(() => ({ id: "monitoring" }) as never),
      createRouteRuntime: vi.fn(() => ({ id: "route" }) as never),
    });

    expect(registry.ensureMonitoring()).toBe(registry.ensureMonitoring());
    expect(registry.ensureRoute()).toBe(registry.ensureRoute());
    expect(registry.ensureEffectsBridge()).toBe(registry.ensureEffectsBridge());
  });

  it("disposes and recreates backend-dependent runtimes on reset", () => {
    const firstEffectsBridge = { dispose: vi.fn(), id: "effects-1" };
    const secondEffectsBridge = { dispose: vi.fn(), id: "effects-2" };
    const firstMonitoringRuntime = { dispose: vi.fn(), id: "monitoring-1" };
    const secondMonitoringRuntime = { dispose: vi.fn(), id: "monitoring-2" };
    let effectsBridgeCreateCount = 0;
    let monitoringCreateCount = 0;
    const createEffectsBridgeRuntime = vi.fn(() => {
      effectsBridgeCreateCount += 1;
      return effectsBridgeCreateCount === 1 ? firstEffectsBridge : secondEffectsBridge;
    });
    const createMonitoringRuntime = vi.fn(() => {
      monitoringCreateCount += 1;
      return monitoringCreateCount === 1 ? firstMonitoringRuntime : secondMonitoringRuntime;
    });
    const registry = createRendererSupportRuntimeRegistry({
      createControlBridgeRuntime: vi.fn(() => ({}) as never),
      createEffectsBridgeRuntime: createEffectsBridgeRuntime as never,
      createMonitoringRuntime: createMonitoringRuntime as never,
      createRouteRuntime: vi.fn(() => ({ id: "route" }) as never),
    });

    expect(registry.ensureEffectsBridge()).toBe(firstEffectsBridge);
    expect(registry.ensureMonitoring()).toBe(firstMonitoringRuntime);

    registry.resetEffectsBridge();
    registry.resetMonitoring();

    expect(firstEffectsBridge.dispose).toHaveBeenCalledTimes(1);
    expect(firstMonitoringRuntime.dispose).toHaveBeenCalledTimes(1);
    expect(registry.ensureEffectsBridge()).toBe(secondEffectsBridge);
    expect(registry.ensureMonitoring()).toBe(secondMonitoringRuntime);
  });
});
