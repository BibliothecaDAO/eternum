import type { RendererControlBridgeRuntime } from "./renderer-control-bridge-runtime";
import type { RendererEffectsBridgeRuntime } from "./renderer-effects-bridge-runtime";
import type { RendererMonitoringRuntime } from "./renderer-monitoring-runtime";
import { createRendererSessionRuntime, type RendererSessionRuntime } from "./renderer-session-runtime";
import {
  createRendererSupportRuntimeRegistry,
  type RendererSupportRuntimeRegistry,
} from "./renderer-support-runtime-registry";
import type { RendererRouteRuntime } from "./renderer-route-runtime";

interface CreateRendererRuntimeAssemblyInput<THudScene> {
  addWindowListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  createControlBridgeRuntime: () => RendererControlBridgeRuntime;
  createEffectsBridgeRuntime: () => RendererEffectsBridgeRuntime;
  createHudScene: () => THudScene;
  createMonitoringRuntime: () => RendererMonitoringRuntime;
  createRouteRuntime: () => RendererRouteRuntime;
  windowResizeListener: EventListenerOrEventListenerObject;
}

export interface RendererRuntimeAssembly<THudScene> {
  sessionRuntime: RendererSessionRuntime<THudScene>;
  supportRuntimeRegistry: RendererSupportRuntimeRegistry;
}

export function createRendererRuntimeAssembly<THudScene>(
  input: CreateRendererRuntimeAssemblyInput<THudScene>,
): RendererRuntimeAssembly<THudScene> {
  const supportRuntimeRegistry = createRendererSupportRuntimeRegistry({
    createControlBridgeRuntime: input.createControlBridgeRuntime,
    createEffectsBridgeRuntime: input.createEffectsBridgeRuntime,
    createMonitoringRuntime: input.createMonitoringRuntime,
    createRouteRuntime: input.createRouteRuntime,
  });
  const sessionRuntime = createRendererSessionRuntime({
    addWindowListener: input.addWindowListener,
    createHudScene: input.createHudScene,
    ensureMonitoring: () => supportRuntimeRegistry.ensureMonitoring(),
    ensureRoute: () => supportRuntimeRegistry.ensureRoute(),
    getMonitoring: () => supportRuntimeRegistry.getMonitoring(),
    windowResizeListener: input.windowResizeListener,
  });

  return {
    sessionRuntime,
    supportRuntimeRegistry,
  };
}
