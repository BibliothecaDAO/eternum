import type { RendererControlBridgeRuntime } from "./renderer-control-bridge-runtime";
import type { RendererEffectsBridgeRuntime } from "./renderer-effects-bridge-runtime";
import type { RendererMonitoringRuntime } from "./renderer-monitoring-runtime";
import type { RendererRouteRuntime } from "./renderer-route-runtime";

interface CreateRendererSupportRuntimeRegistryInput {
  createControlBridgeRuntime: () => RendererControlBridgeRuntime;
  createEffectsBridgeRuntime: () => RendererEffectsBridgeRuntime;
  createMonitoringRuntime: () => RendererMonitoringRuntime;
  createRouteRuntime: () => RendererRouteRuntime;
}

export interface RendererSupportRuntimeRegistry {
  ensureEffectsBridge(): RendererEffectsBridgeRuntime;
  ensureMonitoring(): RendererMonitoringRuntime;
  ensureRoute(): RendererRouteRuntime;
  getControlBridge(): RendererControlBridgeRuntime;
  getEffectsBridge(): RendererEffectsBridgeRuntime | undefined;
  getMonitoring(): RendererMonitoringRuntime | undefined;
  getRoute(): RendererRouteRuntime | undefined;
}

export function createRendererSupportRuntimeRegistry(
  input: CreateRendererSupportRuntimeRegistryInput,
): RendererSupportRuntimeRegistry {
  return new GameRendererSupportRuntimeRegistry(input);
}

class GameRendererSupportRuntimeRegistry implements RendererSupportRuntimeRegistry {
  private readonly controlBridgeRuntime: RendererControlBridgeRuntime;
  private effectsBridgeRuntime?: RendererEffectsBridgeRuntime;
  private monitoringRuntime?: RendererMonitoringRuntime;
  private routeRuntime?: RendererRouteRuntime;

  constructor(private readonly input: CreateRendererSupportRuntimeRegistryInput) {
    this.controlBridgeRuntime = input.createControlBridgeRuntime();
  }

  public getControlBridge(): RendererControlBridgeRuntime {
    return this.controlBridgeRuntime;
  }

  public getMonitoring(): RendererMonitoringRuntime | undefined {
    return this.monitoringRuntime;
  }

  public getRoute(): RendererRouteRuntime | undefined {
    return this.routeRuntime;
  }

  public getEffectsBridge(): RendererEffectsBridgeRuntime | undefined {
    return this.effectsBridgeRuntime;
  }

  public ensureMonitoring(): RendererMonitoringRuntime {
    if (!this.monitoringRuntime) {
      this.monitoringRuntime = this.input.createMonitoringRuntime();
    }

    return this.monitoringRuntime;
  }

  public ensureRoute(): RendererRouteRuntime {
    if (!this.routeRuntime) {
      this.routeRuntime = this.input.createRouteRuntime();
    }

    return this.routeRuntime;
  }

  public ensureEffectsBridge(): RendererEffectsBridgeRuntime {
    if (!this.effectsBridgeRuntime) {
      this.effectsBridgeRuntime = this.input.createEffectsBridgeRuntime();
    }

    return this.effectsBridgeRuntime;
  }
}
