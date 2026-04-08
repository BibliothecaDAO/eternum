import Stats from "three/examples/jsm/libs/stats.module.js";
import type { RendererSurfaceLike } from "./renderer-backend";
import {
  clearGameRendererDebugGlobals,
  registerGameRendererDebugGlobals,
  type RendererDebugWindow,
} from "./game-renderer-debug-globals";
import { StatsRecorder } from "./stats-recorder";
import { MaterialPool } from "./utils/material-pool";
import { MemoryMonitor, MemorySpike } from "./utils/memory-monitor";

export interface RendererMonitoringRuntime {
  initialize(): void;
  updateStatsPanel(): void;
  startStatsRecording(): void;
  stopStatsRecording(): unknown[];
  captureStatsSample(): void;
  exportStatsRecording(): void;
  dispose(): void;
}

interface CreateRendererMonitoringRuntimeInput {
  debugWindow: RendererDebugWindow & object;
  getSceneName: () => string;
  isGraphicsDevEnabled: boolean;
  isMemoryMonitoringEnabled: boolean;
  renderer: RendererSurfaceLike;
  rendererOwner: unknown;
}

export function createRendererMonitoringRuntime(
  input: CreateRendererMonitoringRuntimeInput,
): RendererMonitoringRuntime {
  return new GameRendererMonitoringRuntime(input);
}

class GameRendererMonitoringRuntime implements RendererMonitoringRuntime {
  private stats?: Stats;
  private memoryMonitor?: MemoryMonitor;
  private memoryStatsElement?: HTMLDivElement;
  private memoryMonitorTimeoutId?: ReturnType<typeof setTimeout>;
  private statsDomElement?: HTMLElement;
  private statsRecorder?: StatsRecorder;
  private isDisposed = false;
  private isInitialized = false;

  constructor(private readonly input: CreateRendererMonitoringRuntimeInput) {}

  public initialize(): void {
    if (this.isInitialized || this.isDisposed) {
      return;
    }

    this.initializeStatsPanel();
    this.initializeStatsRecorder();
    this.initializeMemoryMonitoring();
    this.isInitialized = true;
  }

  public updateStatsPanel(): void {
    this.stats?.update();
  }

  public startStatsRecording(): void {
    this.statsRecorder?.start();
  }

  public stopStatsRecording(): unknown[] {
    return this.statsRecorder?.stop() ?? [];
  }

  public captureStatsSample(): void {
    this.statsRecorder?.capture();
  }

  public exportStatsRecording(): void {
    this.statsRecorder?.exportAsJSON();
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    if (this.memoryMonitorTimeoutId) {
      clearTimeout(this.memoryMonitorTimeoutId);
      this.memoryMonitorTimeoutId = undefined;
    }

    clearGameRendererDebugGlobals(this.input.debugWindow);

    if (this.memoryStatsElement?.parentNode) {
      this.memoryStatsElement.parentNode.removeChild(this.memoryStatsElement);
    }
    this.memoryStatsElement = undefined;

    if (this.statsDomElement?.parentNode) {
      this.statsDomElement.parentNode.removeChild(this.statsDomElement);
    }
    this.statsDomElement = undefined;

    this.statsRecorder?.destroy();
    this.statsRecorder = undefined;
    this.memoryMonitor = undefined;
  }

  private initializeStatsPanel(): void {
    const stats = new (Stats as any)();
    this.stats = stats;
    document.body.appendChild(stats.dom);
    this.statsDomElement = stats.dom;
  }

  private initializeStatsRecorder(): void {
    this.statsRecorder = new StatsRecorder({
      getMemoryStatsProvider: () => this.memoryMonitor,
      getRendererInfo: () => this.input.renderer.info,
      getSceneName: this.input.getSceneName,
      isGraphicsDevEnabled: this.input.isGraphicsDevEnabled,
    });
    this.statsRecorder.setupKeyboardShortcuts();
  }

  private initializeMemoryMonitoring(): void {
    if (!this.input.isMemoryMonitoringEnabled) {
      return;
    }

    if (!MemoryMonitor.isMemoryAPISupported()) {
      console.warn("Memory monitoring not supported in this browser");
      return;
    }

    this.memoryMonitor = new MemoryMonitor({
      onMemorySpike: (spike: MemorySpike) => this.handleMemorySpike(spike),
      spikeThresholdMB: 30,
    });
    this.memoryMonitor.setRenderer(this.input.renderer);
    registerGameRendererDebugGlobals(this.input.debugWindow, this.input.rendererOwner, this.input.renderer);
    this.mountMemoryStatsDisplay();
    this.scheduleMemoryMonitoringLoop();
  }

  private handleMemorySpike(spike: MemorySpike): void {
    console.warn(`🚨 Memory spike in ${spike.context}: +${spike.increaseMB.toFixed(1)}MB`);
    if (spike.increaseMB > 100) {
      console.error("🔥 Large memory spike detected!", spike);
    }
  }

  private mountMemoryStatsDisplay(): void {
    this.memoryStatsElement = document.createElement("div");
    this.memoryStatsElement.style.cssText = `
      position: fixed;
      top: 50px;
      left: 0px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      font-family: monospace;
      font-size: 10px;
      padding: 5px;
      border-radius: 3px;
      z-index: 10000;
      min-width: 200px;
    `;
    document.body.appendChild(this.memoryStatsElement);
  }

  private scheduleMemoryMonitoringLoop(): void {
    const updateMemoryStats = () => {
      if (this.isDisposed || !this.memoryMonitor || !this.memoryStatsElement) {
        return;
      }

      try {
        const memoryDisplayState = this.resolveMemoryDisplayState();
        this.memoryStatsElement.innerHTML = this.buildMemoryStatsMarkup(memoryDisplayState);
        this.memoryStatsElement.style.color = memoryDisplayState.memoryColor;
      } catch (error) {
        console.error("Error updating memory stats:", error);
      }

      this.memoryMonitorTimeoutId = setTimeout(updateMemoryStats, 1000);
    };

    updateMemoryStats();
  }

  private resolveMemoryDisplayState(): {
    drawCallColor: string;
    drawCalls: number;
    materialStats: { totalReferences: number; uniqueMaterials: number };
    memoryColor: string;
    sharingRatio: number;
    stats: ReturnType<MemoryMonitor["getCurrentStats"]>;
    summary: ReturnType<MemoryMonitor["getSummary"]>;
    triangles: number;
  } {
    const currentScene = this.input.getSceneName();
    const stats = this.memoryMonitor!.getCurrentStats(currentScene);
    const summary = this.memoryMonitor!.getSummary();
    const materialStats = MaterialPool.getInstance().getStats();
    const sharingRatio = materialStats.totalReferences / Math.max(materialStats.uniqueMaterials, 1);
    const drawCalls = this.input.renderer.info.render.calls;
    const triangles = this.input.renderer.info.render.triangles;
    const drawCallColor = drawCalls > 100 ? "#ff4444" : drawCalls > 50 ? "#ffaa00" : "#00ff00";

    return {
      drawCallColor,
      drawCalls,
      materialStats,
      memoryColor: resolveMemoryStatsColor(stats),
      sharingRatio,
      stats,
      summary,
      triangles,
    };
  }

  private buildMemoryStatsMarkup(input: {
    drawCallColor: string;
    drawCalls: number;
    materialStats: { totalReferences: number; uniqueMaterials: number };
    sharingRatio: number;
    stats: ReturnType<MemoryMonitor["getCurrentStats"]>;
    summary: ReturnType<MemoryMonitor["getSummary"]>;
    triangles: number;
  }): string {
    return `
      <strong>Memory Monitor</strong><br>
      Heap: ${input.stats.heapUsedMB}MB / ${input.stats.heapTotalMB}MB<br>
      Avg: ${input.summary.averageMB}MB<br>
      Trend: ${input.summary.trendMBPerSecond > 0 ? "+" : ""}${input.summary.trendMBPerSecond.toFixed(2)}MB/s<br>
      Spikes: ${input.summary.spikeCount} (max: ${input.summary.largestSpikeMB}MB)<br>
      Resources: G:${input.stats.geometries} M:${input.stats.materials} T:${input.stats.textures}<br>
      Materials: ${input.materialStats.uniqueMaterials} shared (${input.sharingRatio.toFixed(1)}:1)<br>
      <span style="color: ${input.drawCallColor};">Draw Calls: ${input.drawCalls} | Triangles: ${(input.triangles / 1000).toFixed(1)}k</span><br>
      ${input.stats.memorySpike ? `<span style="color: #ff4444;">⚠ SPIKE: +${input.stats.spikeIncrease.toFixed(1)}MB</span>` : ""}
    `;
  }
}

function resolveMemoryStatsColor(stats: ReturnType<MemoryMonitor["getCurrentStats"]>): string {
  const memoryPercent = (stats.heapUsedMB / stats.heapLimitMB) * 100;

  if (memoryPercent > 85) {
    return "#ff4444";
  }
  if (memoryPercent > 70) {
    return "#ffaa00";
  }
  return "#00ff00";
}
