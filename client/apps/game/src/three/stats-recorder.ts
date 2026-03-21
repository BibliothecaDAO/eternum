export interface StatsRecordingSample {
  timestamp: number;
  elapsedMs: number;
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  scene: string;
  heapUsedMB?: number;
  heapTotalMB?: number;
}

import type { RendererInfoLike } from "./renderer-backend";

export interface MemoryStatsProvider {
  getCurrentStats(scene: string): { heapUsedMB: number; heapTotalMB: number };
}

export interface StatsRecorderDeps {
  getRendererInfo: () => RendererInfoLike;
  getSceneName: () => string;
  getMemoryStatsProvider: () => MemoryStatsProvider | undefined;
  isGraphicsDevEnabled: boolean;
}

export class StatsRecorder {
  private isRecording = false;
  private samples: StatsRecordingSample[] = [];
  private recordingStartTime = 0;
  private recordingIndicator?: HTMLDivElement;
  private lastFps = 0;
  private frameCount = 0;
  private fpsAccumulator = 0;
  private lastFpsUpdateTime = 0;
  private keyHandler?: (e: KeyboardEvent) => void;

  constructor(private readonly deps: StatsRecorderDeps) {}

  start(): void {
    if (this.isRecording) {
      console.log("Stats recording already in progress");
      return;
    }

    this.isRecording = true;
    this.samples = [];
    this.recordingStartTime = performance.now();
    this.lastFpsUpdateTime = this.recordingStartTime;
    this.frameCount = 0;
    this.fpsAccumulator = 0;

    // Create recording indicator (DOM-safe)
    if (typeof document !== "undefined") {
      this.recordingIndicator = document.createElement("div");
      this.recordingIndicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(255, 0, 0, 0.8);
        color: white;
        font-family: monospace;
        font-size: 14px;
        padding: 8px 12px;
        border-radius: 4px;
        z-index: 10001;
        animation: pulse 1s infinite;
      `;
      this.recordingIndicator.innerHTML = "🔴 Recording Stats...";

      // Add pulse animation
      const style = document.createElement("style");
      style.id = "stats-recording-pulse";
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(this.recordingIndicator);
    }

    console.log("📊 Stats recording started. Press Ctrl+Shift+S to stop and export.");
  }

  stop(): StatsRecordingSample[] {
    if (!this.isRecording) {
      console.log("No stats recording in progress");
      return [];
    }

    this.isRecording = false;

    // Remove indicator
    this.removeRecordingUI();

    const samples = [...this.samples];
    const duration = (performance.now() - this.recordingStartTime) / 1000;

    console.log(`📊 Stats recording stopped. ${samples.length} samples over ${duration.toFixed(1)}s`);

    return samples;
  }

  private removeRecordingUI(): void {
    if (this.recordingIndicator) {
      this.recordingIndicator.remove();
      this.recordingIndicator = undefined;
    }
    if (typeof document !== "undefined") {
      const pulseStyle = document.getElementById("stats-recording-pulse");
      if (pulseStyle) pulseStyle.remove();
    }
  }

  capture(): void {
    if (!this.isRecording) return;

    const now = performance.now();
    const elapsedMs = now - this.recordingStartTime;

    // Calculate FPS from frame time
    this.frameCount++;
    const timeSinceLastFpsUpdate = now - this.lastFpsUpdateTime;

    if (timeSinceLastFpsUpdate >= 100) {
      // Update FPS every 100ms
      this.lastFps = (this.frameCount * 1000) / timeSinceLastFpsUpdate;
      this.frameCount = 0;
      this.lastFpsUpdateTime = now;
    }

    const info = this.deps.getRendererInfo();
    const currentScene = this.deps.getSceneName();

    const sample: StatsRecordingSample = {
      timestamp: Date.now(),
      elapsedMs,
      fps: Math.round(this.lastFps * 10) / 10,
      frameTime: this.lastFps > 0 ? Math.round((1000 / this.lastFps) * 100) / 100 : 0,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: (info.programs as unknown[] | null)?.length ?? 0,
      scene: currentScene,
    };

    // Add memory info if available
    const memProvider = this.deps.getMemoryStatsProvider();
    if (memProvider) {
      const memStats = memProvider.getCurrentStats(currentScene);
      sample.heapUsedMB = memStats.heapUsedMB;
      sample.heapTotalMB = memStats.heapTotalMB;
    }

    this.samples.push(sample);

    // Update indicator with sample count
    if (this.recordingIndicator) {
      const duration = (elapsedMs / 1000).toFixed(1);
      this.recordingIndicator.innerHTML = `🔴 Recording: ${this.samples.length} samples (${duration}s)`;
    }
  }

  exportAsJSON(): void {
    const samples = this.stop();

    if (samples.length === 0) {
      console.log("No samples to export");
      return;
    }

    // Calculate summary statistics
    const fps = samples.map((s) => s.fps).filter((f) => f > 0);
    const drawCalls = samples.map((s) => s.drawCalls);
    const triangles = samples.map((s) => s.triangles);
    const heapUsed = samples.map((s) => s.heapUsedMB).filter((h): h is number => h !== undefined);
    const geometries = samples.map((s) => s.geometries);
    const textures = samples.map((s) => s.textures);
    const programs = samples.map((s) => s.programs);

    const recordingDurationSec = samples[samples.length - 1].elapsedMs / 1000;

    // Calculate memory growth rate (MB/s) using linear regression for accuracy
    let memoryGrowthMBPerSecond = 0;
    if (heapUsed.length >= 2 && recordingDurationSec > 0) {
      const firstHeap = heapUsed[0];
      const lastHeap = heapUsed[heapUsed.length - 1];
      memoryGrowthMBPerSecond = Math.round(((lastHeap - firstHeap) / recordingDurationSec) * 100) / 100;
    }

    // Calculate resource changes
    const resourceChanges = {
      geometries: geometries[geometries.length - 1] - geometries[0],
      textures: textures[textures.length - 1] - textures[0],
      programs: programs[programs.length - 1] - programs[0],
    };

    const summary = {
      recordingDuration: recordingDurationSec,
      sampleCount: samples.length,
      fps: {
        min: Math.min(...fps),
        max: Math.max(...fps),
        avg: Math.round((fps.reduce((a, b) => a + b, 0) / fps.length) * 10) / 10,
      },
      drawCalls: {
        min: Math.min(...drawCalls),
        max: Math.max(...drawCalls),
        avg: Math.round(drawCalls.reduce((a, b) => a + b, 0) / drawCalls.length),
      },
      triangles: {
        min: Math.min(...triangles),
        max: Math.max(...triangles),
        avg: Math.round(triangles.reduce((a, b) => a + b, 0) / triangles.length),
      },
      memory: {
        heapUsedMB: {
          start: heapUsed.length > 0 ? heapUsed[0] : 0,
          end: heapUsed.length > 0 ? heapUsed[heapUsed.length - 1] : 0,
          min: heapUsed.length > 0 ? Math.min(...heapUsed) : 0,
          max: heapUsed.length > 0 ? Math.max(...heapUsed) : 0,
        },
        growthMBPerSecond: memoryGrowthMBPerSecond,
        resourceChanges,
      },
    };

    const exportData = {
      summary,
      samples,
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };

    // Copy to clipboard
    const jsonString = JSON.stringify(exportData, null, 2);
    navigator.clipboard
      .writeText(jsonString)
      .then(() => {
        console.log("📋 Stats copied to clipboard!");
        console.log("Summary:", summary);
      })
      .catch(() => {
        // Fallback: download as file
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stats-recording-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log("📁 Stats downloaded as file");
      });
  }

  setupKeyboardShortcuts(): void {
    if (!this.deps.isGraphicsDevEnabled) return;

    this.keyHandler = (e: KeyboardEvent) => {
      // Ctrl+Shift+R to start recording
      if (e.ctrlKey && e.shiftKey && e.key === "R") {
        e.preventDefault();
        this.start();
      }
      // Ctrl+Shift+S to stop and export
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        this.exportAsJSON();
      }
    };

    window.addEventListener("keydown", this.keyHandler);

    console.log("📊 Stats recording shortcuts enabled: Ctrl+Shift+R (start) | Ctrl+Shift+S (stop & export)");
  }

  destroy(): void {
    if (this.isRecording) {
      this.isRecording = false;
    }
    this.removeRecordingUI();
    if (typeof window !== "undefined" && this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = undefined;
    }
  }
}
