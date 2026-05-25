import type { RendererMonitoringRuntime } from "./renderer-monitoring-runtime";
import type { RendererRouteRuntime } from "./renderer-route-runtime";

interface CreateRendererSessionRuntimeInput<THudScene> {
  addWindowListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  createHudScene: () => THudScene;
  ensureMonitoring: () => RendererMonitoringRuntime;
  ensureRoute: () => RendererRouteRuntime;
  getMonitoring: () => RendererMonitoringRuntime | undefined;
  windowResizeListener: EventListenerOrEventListenerObject;
}

export interface RendererSessionRuntime<THudScene> {
  captureStatsSample(): void;
  createHudScene(): THudScene;
  exportStatsRecording(): void;
  initializeMonitoring(): void;
  startListeners(): void;
  startStatsRecording(): void;
  stopStatsRecording(): unknown[];
  syncRouteFromLocation(): void;
  updateStatsPanel(): void;
}

export function createRendererSessionRuntime<THudScene>(
  input: CreateRendererSessionRuntimeInput<THudScene>,
): RendererSessionRuntime<THudScene> {
  return {
    captureStatsSample() {
      input.getMonitoring()?.captureStatsSample();
    },

    createHudScene() {
      return input.createHudScene();
    },

    exportStatsRecording() {
      input.getMonitoring()?.exportStatsRecording();
    },

    initializeMonitoring() {
      input.ensureMonitoring().initialize();
    },

    startListeners() {
      input.ensureRoute().start();
      input.addWindowListener("resize", input.windowResizeListener);
    },

    startStatsRecording() {
      input.getMonitoring()?.startStatsRecording();
    },

    stopStatsRecording() {
      return input.getMonitoring()?.stopStatsRecording() ?? [];
    },

    syncRouteFromLocation() {
      input.ensureRoute().syncFromLocation();
    },

    updateStatsPanel() {
      input.getMonitoring()?.updateStatsPanel();
    },
  };
}
