import { useUIStore } from "@/hooks/store/use-ui-store";
import { getGameModeId } from "@/config/game-modes";
import {
  CAMERA_CONFIG,
  CAMERA_FAR_PLANE,
  CONTROL_CONFIG,
  POST_PROCESSING_CONFIG,
  type PostProcessingConfig,
} from "@/three/constants";
import { TransitionManager } from "@/three/managers/transition-manager";
import { SceneManager } from "@/three/scene-manager";
import { CameraView } from "@/three/scenes/hexagon-scene";
import FastTravelScene from "@/three/scenes/fast-travel";
import HexceptionScene from "@/three/scenes/hexception";
import HUDScene from "@/three/scenes/hud-scene";
import WorldmapScene from "@/three/scenes/worldmap";
import { GUIManager } from "@/three/utils/";
import { GRAPHICS_SETTING, GraphicsSettings, IS_MOBILE } from "@/ui/config";
import { SetupResult } from "@bibliothecadao/dojo";
import { ToneMappingMode } from "postprocessing";
import {
  ACESFilmicToneMapping,
  CineonToneMapping,
  LinearToneMapping,
  NoToneMapping,
  PerspectiveCamera,
  Raycaster,
  ReinhardToneMapping,
  Vector2,
} from "three";
import { CSS2DRenderer } from "three-stdlib";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { env } from "../../env";
import { resolveNavigationSceneTarget } from "./scene-navigation-boundary";
import { resolveSceneNameFromRouteSegment } from "./scene-route-policy";
import { SceneName } from "./types";
import {
  resolveCapabilityAwareRendererEffectPlan,
  resolveLabelRenderDecision,
  resolveLabelRenderIntervalMs,
  resolveRendererEnvironmentPolicy,
  resolvePostProcessingEffectPlan,
  shouldEnablePostProcessingConfig,
} from "./game-renderer-policy";
import { clearGameRendererDebugGlobals, registerGameRendererDebugGlobals } from "./game-renderer-debug-globals";
import {
  replaceRendererDiagnosticDegradations,
  setRendererDiagnosticCapabilities,
  setRendererDiagnosticDegradations,
  setRendererDiagnosticEffectPlan,
  setRendererDiagnosticPostprocessPolicy,
  snapshotRendererDiagnostics,
  setRendererDiagnosticSceneName,
  syncRendererBackendDiagnostics,
} from "./renderer-diagnostics";
import {
  applyRendererBackendEnvironment,
  applyRendererBackendPostProcessPlan,
  applyRendererBackendQuality,
  disposeRendererBackend,
  renderRendererBackendFrame,
  resizeRendererBackend,
} from "./renderer-backend-compat";
import { initializeSelectedRendererBackend } from "./renderer-backend-loader";
import { transitionDB } from "./utils/";
import { getContactShadowResources } from "./utils/contact-shadow";
import { destroyTrackedGuiFolders, trackGuiFolder, type TrackableGuiFolder } from "./utils/gui-folder-lifecycle";
import { MaterialPool } from "./utils/material-pool";
import { MemoryMonitor, MemorySpike } from "./utils/memory-monitor";
import { qualityController, type QualityFeatures } from "./utils/quality-controller";
import {
  createWebGLRendererBackend,
  type RendererBackendFactory,
  type RendererSurfaceLike,
} from "./renderer-backend";
import { createWebGPURendererBackend } from "./webgpu-renderer-backend";
import type { RendererBackendV2, RendererPostProcessController, RendererPostProcessPlan } from "./renderer-backend-v2";
import { requestRendererScenePrewarm, resolveWebgpuPostprocessPolicy } from "./webgpu-postprocess-policy";

const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;
const GRAPHICS_DEV_ENABLED = env.VITE_PUBLIC_GRAPHICS_DEV;

// Stats recording types
interface StatsRecordingSample {
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

const DEFAULT_ENVIRONMENT_INTENSITY: Record<GraphicsSettings, number> = {
  [GraphicsSettings.HIGH]: 0.55,
  [GraphicsSettings.MID]: 0.45,
  [GraphicsSettings.LOW]: 0.25,
};

export default class GameRenderer {
  private labelRenderer!: CSS2DRenderer;
  private labelRendererElement!: HTMLDivElement;
  private backend!: RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
  private renderer!: RendererSurfaceLike;
  private camera!: PerspectiveCamera;
  private raycaster!: Raycaster;
  private mouse!: Vector2;
  private controls!: MapControls;
  private postProcessingConfig?: PostProcessingConfig;
  private postProcessController?: RendererPostProcessController;
  private postProcessingGUIInitialized = false;
  private labelsDirty = true;
  private lastLabelRenderTime = 0;
  private lastLabelsActive = false;

  // Weather-based post-processing modulation
  private basePostProcessingValues = {
    saturation: 0,
    contrast: 0,
    brightness: 0,
    vignetteDarkness: 0,
  };
  private weatherPostProcessingEnabled = true;
  private unsubscribeQualityController?: () => void;
  private lastAppliedQuality?: QualityFeatures;

  // Stats and Monitoring
  private stats!: Stats;
  private memoryMonitor?: MemoryMonitor;
  private memoryStatsElement?: HTMLDivElement;
  private statsDomElement?: HTMLElement;

  // Stats Recording
  private isRecordingStats = false;
  private statsRecordingSamples: StatsRecordingSample[] = [];
  private statsRecordingStartTime = 0;
  private statsRecordingIndicator?: HTMLDivElement;
  private lastFps = 0;
  private frameCount = 0;
  private fpsAccumulator = 0;
  private lastFpsUpdateTime = 0;

  // Camera settings
  private cameraDistance = CAMERA_CONFIG.defaultDistance; // Maintain the same distance
  private cameraAngle = CAMERA_CONFIG.defaultAngle;

  // Components
  private transitionManager!: TransitionManager;

  // Scenes
  private worldmapScene!: WorldmapScene;
  private fastTravelScene?: FastTravelScene;
  private hexceptionScene!: HexceptionScene;
  private hudScene!: HUDScene;

  private lastTime: number = 0;
  private dojo: SetupResult;
  private sceneManager!: SceneManager;
  private graphicsSetting: GraphicsSettings;
  private cleanupIntervals: NodeJS.Timeout[] = [];
  private guiFolders: TrackableGuiFolder[] = [];
  private unsubscribeEnableMapZoom?: () => void;
  private memoryMonitorTimeoutId?: ReturnType<typeof setTimeout>;
  private readonly isMobileDevice = IS_MOBILE;
  private backendInitializationPromise?: Promise<void>;
  private readonly handleWindowResize = () => this.onWindowResize();
  private readonly handleDocumentFocus = (event: FocusEvent) => {
    if (event.target instanceof HTMLInputElement && this.controls) {
      this.controls.stopListenToKeyEvents();
    }
  };
  private readonly handleDocumentBlur = (event: FocusEvent) => {
    if (event.target instanceof HTMLInputElement && this.controls) {
      this.controls.listenToKeyEvents(document.body);
    }
  };

  constructor(dojoContext: SetupResult) {
    this.graphicsSetting = GRAPHICS_SETTING;
    this.dojo = dojoContext;

    this.backendInitializationPromise = this.initializeRendererBackend();
    this.initializeCamera();
    this.initializeRaycaster();

    this.waitForLabelRendererElement()
      .then((labelRendererElement) => {
        if (this.isDestroyed) {
          return;
        }
        this.labelRendererElement = labelRendererElement;
        this.initializeLabelRenderer();
      })
      .catch((error) => {
        console.warn("GameRenderer: Failed to initialize label renderer:", error);
      });
  }

  private initializeRaycaster() {
    this.raycaster = new Raycaster();
    this.mouse = new Vector2();
  }

  private initializeCamera() {
    this.camera = new PerspectiveCamera(
      CAMERA_CONFIG.fov,
      window.innerWidth / window.innerHeight,
      CAMERA_CONFIG.near,
      CAMERA_FAR_PLANE,
    );
    const cameraHeight = Math.sin(this.cameraAngle) * this.cameraDistance;
    const cameraDepth = Math.cos(this.cameraAngle) * this.cameraDistance;
    this.camera.position.set(0, cameraHeight, cameraDepth);
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 1, 0);
  }

  private setupGUIControls() {
    this.setupSceneSwitchingGUI();
    this.setupCameraMovementGUI();
    this.setupRendererGUI();
  }

  private isFastTravelEnabled(): boolean {
    return getGameModeId() !== "blitz";
  }

  private setupSceneSwitchingGUI() {
    const changeSceneFolder = trackGuiFolder(this.guiFolders, GUIManager.addFolder("Switch scene"));
    const changeSceneParams = { scene: SceneName.WorldMap };
    const sceneOptions = this.isFastTravelEnabled()
      ? [SceneName.WorldMap, SceneName.Hexception, SceneName.FastTravel]
      : [SceneName.WorldMap, SceneName.Hexception];
    changeSceneFolder.add(changeSceneParams, "scene", sceneOptions).name("Scene");
    changeSceneFolder.add({ switchScene: () => this.sceneManager.switchScene(changeSceneParams.scene) }, "switchScene");
    changeSceneFolder.close();
  }

  private setupCameraMovementGUI() {
    const moveCameraFolder = trackGuiFolder(this.guiFolders, GUIManager.addFolder("Move Camera"));
    const moveCameraParams = { col: 0, row: 0, x: 0, y: 0, z: 0 };

    moveCameraFolder.add(moveCameraParams, "col").name("Column");
    moveCameraFolder.add(moveCameraParams, "row").name("Row");
    moveCameraFolder.add(moveCameraParams, "x").name("X");
    moveCameraFolder.add(moveCameraParams, "y").name("Y");
    moveCameraFolder.add(moveCameraParams, "z").name("Z");

    moveCameraFolder
      .add(
        {
          move: () => this.worldmapScene.moveCameraToColRow(moveCameraParams.col, moveCameraParams.row, 0),
        },
        "move",
      )
      .name("Move Camera");

    moveCameraFolder.add(
      {
        move: () => this.worldmapScene.moveCameraToXYZ(moveCameraParams.x, moveCameraParams.y, moveCameraParams.z, 0),
      },
      "move",
    );

    // Add camera view controls
    const cameraViewParams = { view: 2 };
    moveCameraFolder.add(cameraViewParams, "view", [1, 2, 3]).name("Camera View");
    moveCameraFolder
      .add(
        {
          changeView: () => this.worldmapScene.changeCameraView(cameraViewParams.view as 1 | 2 | 3),
        },
        "changeView",
      )
      .name("Change View");

    moveCameraFolder.close();
  }

  private setupRendererGUI() {
    const rendererFolder = trackGuiFolder(this.guiFolders, GUIManager.addFolder("Renderer"));
    rendererFolder
      .add(this.renderer, "toneMapping", {
        "No Tone Mapping": NoToneMapping,
        "Linear Tone Mapping": LinearToneMapping,
        "Reinhard Tone Mapping": ReinhardToneMapping,
        "Cineon Tone Mapping": CineonToneMapping,
        "ACESFilmic Tone Mapping": ACESFilmicToneMapping,
      })
      .name("Tone Mapping");
    rendererFolder.add(this.renderer, "toneMappingExposure", 0, 2).name("Tone Mapping Exposure");
    rendererFolder.close();

    const contactShadowFolder = trackGuiFolder(this.guiFolders, GUIManager.addFolder("Contact Shadows"));
    const { material } = getContactShadowResources();
    const params = { opacity: material.opacity };
    contactShadowFolder
      .add(params, "opacity", 0, 0.6, 0.01)
      .name("Opacity")
      .onChange((value: number) => {
        material.opacity = value;
      });
    contactShadowFolder.close();
  }

  private initializeLabelRenderer() {
    this.labelRenderer = new CSS2DRenderer({ element: this.labelRendererElement });
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  }

  private async waitForLabelRendererElement(): Promise<HTMLDivElement> {
    return new Promise((resolve) => {
      const WARN_AFTER_ATTEMPTS = 300; // ~5 seconds at 60fps
      let attempts = 0;

      const checkElement = () => {
        if (this.isDestroyed) {
          return;
        }

        const element = document.getElementById("labelrenderer") as HTMLDivElement | null;
        if (element) {
          resolve(element);
          return;
        }

        attempts++;
        if (attempts === WARN_AFTER_ATTEMPTS) {
          console.warn("GameRenderer: labelrenderer element not found yet; continuing to wait for world UI to mount");
        }

        requestAnimationFrame(checkElement);
      };

      checkElement();
    });
  }

  private async initializeRendererBackend(backendFactory?: RendererBackendFactory): Promise<void> {
    if (backendFactory) {
      this.backend = backendFactory({
        graphicsSetting: this.graphicsSetting,
        isMobileDevice: this.isMobileDevice,
        pixelRatio: this.getTargetPixelRatio(),
      });
      this.renderer = this.backend.renderer;
      const diagnostics = await this.backend.initialize();
      syncRendererBackendDiagnostics(diagnostics);
      setRendererDiagnosticCapabilities(this.backend.capabilities);
      setRendererDiagnosticDegradations([]);
      return;
    }

    const pixelRatio = this.getTargetPixelRatio();
    const result = await initializeSelectedRendererBackend({
      experimentalFactory: async ({ requestedMode }) => {
        const backend = createWebGPURendererBackend({
          graphicsSetting: this.graphicsSetting,
          isMobileDevice: this.isMobileDevice,
          pixelRatio,
          requestedMode,
        });
        const diagnostics = await backend.initialize();

        return {
          backend,
          diagnostics,
        };
      },
      legacyFactory: async () => {
        const backend = createWebGLRendererBackend({
          graphicsSetting: this.graphicsSetting,
          isMobileDevice: this.isMobileDevice,
          pixelRatio,
        });
        const diagnostics = await backend.initialize();

        return {
          backend,
          diagnostics,
        };
      },
      options: {
        envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
        graphicsSetting: this.graphicsSetting,
        isMobileDevice: this.isMobileDevice,
        pixelRatio,
        search: window.location.search,
      },
    });

    const backend = result.backend as RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
    this.backend = backend;
    this.renderer = backend.renderer;
  }

  initStats() {
    this.stats = new (Stats as any)();
    document.body.appendChild(this.stats.dom);
    this.statsDomElement = this.stats.dom;

    // Initialize memory monitoring
    this.initMemoryMonitoring();

    // Setup stats recording keyboard shortcuts
    this.setupStatsRecordingKeyboardShortcuts();
  }

  public initMemoryMonitoring() {
    if (!MEMORY_MONITORING_ENABLED) {
      return;
    }

    // Check if memory API is supported
    if (!MemoryMonitor.isMemoryAPISupported()) {
      console.warn("Memory monitoring not supported in this browser");
      return;
    }

    // Initialize memory monitor with spike detection
    this.memoryMonitor = new MemoryMonitor({
      spikeThresholdMB: 30, // Alert on 30MB+ spikes during gameplay
      onMemorySpike: (spike: MemorySpike) => {
        console.warn(`🚨 Memory spike in ${spike.context}: +${spike.increaseMB.toFixed(1)}MB`);

        // Additional logging for large spikes
        if (spike.increaseMB > 100) {
          console.error("🔥 Large memory spike detected!", spike);
          // Could trigger additional debugging here
        }
      },
    });

    // Provide renderer reference for better resource tracking
    this.memoryMonitor.setRenderer(this.renderer);
    registerGameRendererDebugGlobals(window, this, this.renderer);

    // Create memory stats display element
    this.createMemoryStatsDisplay();

    // Start periodic memory monitoring
    this.startMemoryMonitoring();
  }

  private createMemoryStatsDisplay() {
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

  private startMemoryMonitoring() {
    const updateMemoryStats = () => {
      if (this.isDestroyed || !this.memoryMonitor || !this.memoryStatsElement) {
        return;
      }

      try {
        const currentScene = this.sceneManager?.getCurrentScene() || "unknown";
        const stats = this.memoryMonitor.getCurrentStats(currentScene);
        const summary = this.memoryMonitor.getSummary();

        // Get material pool stats
        const materialStats = MaterialPool.getInstance().getStats();
        const sharingRatio = materialStats.totalReferences / Math.max(materialStats.uniqueMaterials, 1);

        // Get renderer draw call stats
        const drawCalls = this.renderer.info.render.calls;
        const triangles = this.renderer.info.render.triangles;
        const drawCallColor = drawCalls > 100 ? "#ff4444" : drawCalls > 50 ? "#ffaa00" : "#00ff00";

        // Update display
        this.memoryStatsElement.innerHTML = `
          <strong>Memory Monitor</strong><br>
          Heap: ${stats.heapUsedMB}MB / ${stats.heapTotalMB}MB<br>
          Avg: ${summary.averageMB}MB<br>
          Trend: ${summary.trendMBPerSecond > 0 ? "+" : ""}${summary.trendMBPerSecond.toFixed(2)}MB/s<br>
          Spikes: ${summary.spikeCount} (max: ${summary.largestSpikeMB}MB)<br>
          Resources: G:${stats.geometries} M:${stats.materials} T:${stats.textures}<br>
          Materials: ${materialStats.uniqueMaterials} shared (${sharingRatio.toFixed(1)}:1)<br>
          <span style="color: ${drawCallColor};">Draw Calls: ${drawCalls} | Triangles: ${(triangles / 1000).toFixed(1)}k</span><br>
          ${stats.memorySpike ? `<span style="color: #ff4444;">⚠ SPIKE: +${stats.spikeIncrease.toFixed(1)}MB</span>` : ""}
        `;

        // Color coding based on memory usage
        const memoryPercent = (stats.heapUsedMB / stats.heapLimitMB) * 100;
        let color = "#00ff00"; // Green
        if (memoryPercent > 70) color = "#ffaa00"; // Orange
        if (memoryPercent > 85) color = "#ff4444"; // Red

        this.memoryStatsElement.style.color = color;
      } catch (error) {
        console.error("Error updating memory stats:", error);
      }

      // Schedule next update (every second)
      this.memoryMonitorTimeoutId = setTimeout(updateMemoryStats, 1000);
    };

    // Start monitoring
    updateMemoryStats();
  }

  // Stats Recording Methods
  public startStatsRecording() {
    if (this.isRecordingStats) {
      console.log("Stats recording already in progress");
      return;
    }

    this.isRecordingStats = true;
    this.statsRecordingSamples = [];
    this.statsRecordingStartTime = performance.now();
    this.lastFpsUpdateTime = this.statsRecordingStartTime;
    this.frameCount = 0;
    this.fpsAccumulator = 0;

    // Create recording indicator
    this.statsRecordingIndicator = document.createElement("div");
    this.statsRecordingIndicator.style.cssText = `
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
    this.statsRecordingIndicator.innerHTML = "🔴 Recording Stats...";

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
    document.body.appendChild(this.statsRecordingIndicator);

    console.log("📊 Stats recording started. Press Ctrl+Shift+S to stop and export.");
  }

  public stopStatsRecording(): StatsRecordingSample[] {
    if (!this.isRecordingStats) {
      console.log("No stats recording in progress");
      return [];
    }

    this.isRecordingStats = false;

    // Remove indicator
    if (this.statsRecordingIndicator) {
      this.statsRecordingIndicator.remove();
      this.statsRecordingIndicator = undefined;
    }
    const pulseStyle = document.getElementById("stats-recording-pulse");
    if (pulseStyle) pulseStyle.remove();

    const samples = [...this.statsRecordingSamples];
    const duration = (performance.now() - this.statsRecordingStartTime) / 1000;

    console.log(`📊 Stats recording stopped. ${samples.length} samples over ${duration.toFixed(1)}s`);

    return samples;
  }

  private captureStatsSample() {
    if (!this.isRecordingStats) return;

    const now = performance.now();
    const elapsedMs = now - this.statsRecordingStartTime;

    // Calculate FPS from frame time
    this.frameCount++;
    const timeSinceLastFpsUpdate = now - this.lastFpsUpdateTime;

    if (timeSinceLastFpsUpdate >= 100) {
      // Update FPS every 100ms
      this.lastFps = (this.frameCount * 1000) / timeSinceLastFpsUpdate;
      this.frameCount = 0;
      this.lastFpsUpdateTime = now;
    }

    const info = this.renderer.info;
    const currentScene = this.sceneManager?.getCurrentScene() || "unknown";

    const sample: StatsRecordingSample = {
      timestamp: Date.now(),
      elapsedMs,
      fps: Math.round(this.lastFps * 10) / 10,
      frameTime: this.lastFps > 0 ? Math.round((1000 / this.lastFps) * 100) / 100 : 0,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length || 0,
      scene: currentScene,
    };

    // Add memory info if available
    if (this.memoryMonitor) {
      const memStats = this.memoryMonitor.getCurrentStats(currentScene);
      sample.heapUsedMB = memStats.heapUsedMB;
      sample.heapTotalMB = memStats.heapTotalMB;
    }

    this.statsRecordingSamples.push(sample);

    // Update indicator with sample count
    if (this.statsRecordingIndicator) {
      const duration = (elapsedMs / 1000).toFixed(1);
      this.statsRecordingIndicator.innerHTML = `🔴 Recording: ${this.statsRecordingSamples.length} samples (${duration}s)`;
    }
  }

  public exportStatsRecording() {
    const samples = this.stopStatsRecording();

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

  private setupStatsRecordingKeyboardShortcuts() {
    if (!GRAPHICS_DEV_ENABLED) return;

    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+R to start recording
      if (e.ctrlKey && e.shiftKey && e.key === "R") {
        e.preventDefault();
        this.startStatsRecording();
      }
      // Ctrl+Shift+S to stop and export
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        this.exportStatsRecording();
      }
    };

    window.addEventListener("keydown", handler);

    // Store for cleanup
    (this as any)._statsRecordingKeyHandler = handler;

    console.log("📊 Stats recording shortcuts enabled: Ctrl+Shift+R (start) | Ctrl+Shift+S (stop & export)");
  }

  async initScene() {
    await this.backendInitializationPromise;
    this.setupGUIControls();
    this.setupListeners();

    document.body.style.background = "black";
    this.renderer.domElement.id = "main-canvas";

    // CRITICAL: Remove any existing canvas before adding a new one
    // This prevents memory leaks from multiple canvases when navigating home and back
    const existingCanvas = document.getElementById("main-canvas");
    if (existingCanvas) {
      console.warn("[GameRenderer] Found existing canvas, removing it to prevent memory leak");
      existingCanvas.remove();
    }

    document.body.appendChild(this.renderer.domElement);

    // Set up periodic cleanup of the transition database
    const dbCleanupInterval = setInterval(() => {
      // Clean up expired records older than 10 seconds
      const cleanedCount = transitionDB.cleanupExpired(10000);
      if (cleanedCount > 0) {
        console.debug(`Cleaned up ${cleanedCount} expired transition records`);
      }
    }, 30 * 1000); // Run every 30 seconds

    // Store the interval ID for cleanup
    this.cleanupIntervals = this.cleanupIntervals || [];
    this.cleanupIntervals.push(dbCleanupInterval);

    // Adjust OrbitControls for new camera angle
    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = CONTROL_CONFIG.enableRotate;
    const zoomSetting = useUIStore.getState().enableMapZoom;
    console.log(`[GameRenderer] Setting enableZoom to: ${zoomSetting}`);
    this.controls.enableZoom = zoomSetting;
    this.controls.enablePan = CONTROL_CONFIG.enablePan;
    this.controls.panSpeed = CONTROL_CONFIG.panSpeed;
    this.controls.zoomToCursor = CONTROL_CONFIG.zoomToCursor;
    this.controls.minDistance = CONTROL_CONFIG.minDistance;
    this.controls.maxDistance = CONTROL_CONFIG.maxDistance;
    this.controls.enableDamping = CONTROL_CONFIG.enableDamping && this.graphicsSetting === GraphicsSettings.HIGH;
    this.controls.dampingFactor = CONTROL_CONFIG.dampingFactor;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener("change", () => {
      this.labelsDirty = true;
      if (this.sceneManager?.getCurrentScene() === SceneName.WorldMap) {
        this.worldmapScene.requestChunkRefresh();
      } else if (this.sceneManager?.getCurrentScene() === SceneName.FastTravel && this.fastTravelScene) {
        this.fastTravelScene.requestSceneRefresh();
      }
    });
    this.controls.keys = {
      LEFT: "KeyA",
      UP: "KeyW",
      RIGHT: "KeyD",
      BOTTOM: "KeyS",
    };
    this.controls.keyPanSpeed = CONTROL_CONFIG.keyPanSpeed;
    this.controls.listenToKeyEvents(document.body);

    // Subscribe to zoom setting changes
    this.unsubscribeEnableMapZoom = useUIStore.subscribe(
      (state) => state.enableMapZoom,
      (enableMapZoom) => {
        console.log(`[GameRenderer] Zoom setting changed to: ${enableMapZoom}`);
        if (this.controls) {
          this.controls.enableZoom = enableMapZoom;
        }
      },
    );

    document.addEventListener("focus", this.handleDocumentFocus, true);
    document.addEventListener("blur", this.handleDocumentBlur, true);

    // Create HUD scene
    this.hudScene = new HUDScene(this.sceneManager, this.controls);

    this.prepareScenes();
    this.handleURLChange();
    // Init animation
    this.animate();
  }

  private setupListeners() {
    window.addEventListener("urlChanged", this.handleURLChange);
    window.addEventListener("popstate", this.handleURLChange);
    window.addEventListener("resize", this.handleWindowResize);
  }

  private handleURLChange = () => {
    const url = new URL(window.location.href);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const sceneSlug = pathSegments.pop();
    const fastTravelEnabled = this.isFastTravelEnabled();
    const targetScene = resolveNavigationSceneTarget({
      requestedScene: resolveSceneNameFromRouteSegment(sceneSlug),
      currentPath: url.pathname,
      fastTravelEnabled,
    });

    if (
      targetScene === this.sceneManager.getCurrentScene() &&
      (targetScene === SceneName.WorldMap || (targetScene === SceneName.FastTravel && this.fastTravelScene))
    ) {
      this.sceneManager.moveCameraForScene();
      this.transitionManager?.fadeIn();
    } else {
      this.sceneManager.switchScene(targetScene);
    }

    this.labelsDirty = true;
  };

  async prepareScenes() {
    this.initializeSceneManagement();
    this.initializeScenes();
    this.requestScenePrewarm(this.worldmapScene);
    this.requestScenePrewarm(this.hexceptionScene);
    this.requestScenePrewarm(this.fastTravelScene);
    this.applyEnvironment();
    this.setupPostProcessingEffects();
    this.sceneManager.moveCameraForScene();
    this.applyQualityFeatures(qualityController.getFeatures());
    this.subscribeToQualityController();
  }

  private initializeSceneManagement() {
    this.transitionManager = new TransitionManager();
    this.sceneManager = new SceneManager(this.transitionManager);
  }

  private initializeScenes() {
    // Initialize Hexception scene
    this.hexceptionScene = new HexceptionScene(this.controls, this.dojo, this.mouse, this.raycaster, this.sceneManager);
    this.hexceptionScene.setInputSurface(this.renderer.domElement);
    this.sceneManager.addScene(SceneName.Hexception, this.hexceptionScene);

    // Initialize WorldMap scene
    this.worldmapScene = new WorldmapScene(this.dojo, this.raycaster, this.controls, this.mouse, this.sceneManager);
    this.worldmapScene.setInputSurface(this.renderer.domElement);
    this.sceneManager.addScene(SceneName.WorldMap, this.worldmapScene);

    if (this.isFastTravelEnabled()) {
      // Initialize FastTravel scene for non-Blitz modes only.
      this.fastTravelScene = new FastTravelScene(
        this.dojo,
        this.raycaster,
        this.controls,
        this.mouse,
        this.sceneManager,
      );
      this.fastTravelScene.setInputSurface(this.renderer.domElement);
      this.sceneManager.addScene(SceneName.FastTravel, this.fastTravelScene);
    } else {
      this.fastTravelScene = undefined;
    }
  }

  private setupPostProcessingEffects() {
    const effectsConfig = this.getPostProcessingConfig();
    if (!effectsConfig) {
      return; // Skip post-processing for low graphics settings
    }
    this.postProcessingConfig = effectsConfig;
    this.rebuildPostProcessing(qualityController.getFeatures());
    this.setupToneMappingGUI(effectsConfig);
    this.setupPostProcessingGUI(effectsConfig);
  }

  private setupToneMappingGUI(config: PostProcessingConfig): void {
    const folder = trackGuiFolder(this.guiFolders, GUIManager.addFolder("Tone Mapping"));
    folder
      .add(config.toneMapping, "mode", {
        ...ToneMappingMode,
      })
      .onChange(() => this.rebuildPostProcessing(qualityController.getFeatures()));

    folder.add(config.toneMapping, "exposure", 0.0, 2.0, 0.01).onChange(() => this.rebuildPostProcessing(qualityController.getFeatures()));

    folder
      .add(config.toneMapping, "whitePoint", 0.0, 2.0, 0.01)
      .onChange(() => this.rebuildPostProcessing(qualityController.getFeatures()));

    folder.close();
  }

  private getPostProcessingConfig(): PostProcessingConfig | null {
    const effectsConfig = POST_PROCESSING_CONFIG[this.graphicsSetting];
    if (
      !shouldEnablePostProcessingConfig({
        hasPostProcessingConfig: effectsConfig !== null,
        isMobileDevice: this.isMobileDevice,
        isHighGraphicsSetting: this.graphicsSetting === GraphicsSettings.HIGH,
      })
    ) {
      return null;
    }

    return effectsConfig;
  }

  private setupPostProcessingGUI(config: PostProcessingConfig): void {
    if (this.postProcessingGUIInitialized) {
      return;
    }
    this.postProcessingGUIInitialized = true;

    const folder = trackGuiFolder(this.guiFolders, GUIManager.addFolder("Color Grade"));

    folder
      .add(config, "saturation", -0.5, 0.5, 0.01)
      .name("Saturation")
      .onChange((value: number) => {
        config.saturation = value;
        this.postProcessController?.setColorGrade({ saturation: value });
      });

    folder
      .add(config, "hue", -0.5, 0.5, 0.01)
      .name("Hue")
      .onChange((value: number) => {
        config.hue = value;
        this.postProcessController?.setColorGrade({ hue: value });
      });

    folder
      .add(config, "brightness", -0.5, 0.5, 0.01)
      .name("Brightness")
      .onChange((value: number) => {
        config.brightness = value;
        this.postProcessController?.setColorGrade({ brightness: value });
      });

    folder
      .add(config, "contrast", -0.5, 0.5, 0.01)
      .name("Contrast")
      .onChange((value: number) => {
        config.contrast = value;
        this.postProcessController?.setColorGrade({ contrast: value });
      });

    folder.close();

    const vignetteFolder = trackGuiFolder(this.guiFolders, GUIManager.addFolder("Vignette"));
    vignetteFolder.add(config.vignette, "darkness", 0.0, 1.0, 0.01).onChange((value: number) => {
      config.vignette.darkness = value;
      this.postProcessController?.setVignette({ darkness: value });
    });

    vignetteFolder.add(config.vignette, "offset", 0.0, 1.0, 0.01).onChange((value: number) => {
      config.vignette.offset = value;
      this.postProcessController?.setVignette({ offset: value });
    });

    vignetteFolder.close();
  }

  applyEnvironment() {
    const environmentPolicy = resolveRendererEnvironmentPolicy({
      capabilities: this.backend.capabilities,
      intensity: DEFAULT_ENVIRONMENT_INTENSITY[this.graphicsSetting],
    });

    replaceRendererDiagnosticDegradations(["environmentIbl"], environmentPolicy.degradations);

    if (!environmentPolicy.shouldApplyEnvironment) {
      return;
    }

    void applyRendererBackendEnvironment(this.backend, {
      hexceptionScene: this.hexceptionScene,
      worldmapScene: this.worldmapScene,
      fastTravelScene: this.fastTravelScene,
      intensity: environmentPolicy.intensity,
    });
  }

  private getTargetPixelRatio() {
    const devicePixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    const mobileCap = this.getMobilePixelRatioCap();

    switch (this.graphicsSetting) {
      case GraphicsSettings.HIGH:
        return Math.min(devicePixelRatio, 2, mobileCap);
      case GraphicsSettings.MID:
        return Math.min(devicePixelRatio, 1.5, mobileCap);
      default:
        return Math.min(1, mobileCap);
    }
  }

  private getTargetFPS(): number | null {
    if (this.isMobileDevice) {
      switch (this.graphicsSetting) {
        case GraphicsSettings.HIGH:
          return 45;
        case GraphicsSettings.MID:
          return 30;
        default:
          return 30;
      }
    }

    switch (this.graphicsSetting) {
      case GraphicsSettings.LOW:
        return 30;
      case GraphicsSettings.MID:
        return 45;
      default:
        return null;
    }
  }

  private getMobilePixelRatioCap(): number {
    if (!this.isMobileDevice) {
      return Number.POSITIVE_INFINITY;
    }

    switch (this.graphicsSetting) {
      case GraphicsSettings.HIGH:
        return 1.5;
      case GraphicsSettings.MID:
        return 1.25;
      default:
        return 1;
    }
  }

  public resolvePixelRatio(pixelRatio: number): number {
    const mobileCap = this.getMobilePixelRatioCap();
    return Math.min(pixelRatio, mobileCap);
  }

  handleKeyEvent(event: KeyboardEvent): void {
    const { key } = event;

    switch (key) {
      case "e":
        break;
      case "Escape":
        if (this.sceneManager?.getCurrentScene() === SceneName.Hexception) {
          this.sceneManager.switchScene(SceneName.WorldMap);
        }
        break;
      default:
        break;
    }
  }

  onWindowResize() {
    this.labelsDirty = true;
    const container = document.getElementById("three-container");
    if (container) {
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      resizeRendererBackend(this.backend, width, height);
      this.labelRenderer?.setSize(width, height);
      this.hudScene.onWindowResize(width, height);
    } else {
      // Fallback to window size if container not found
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      resizeRendererBackend(this.backend, window.innerWidth, window.innerHeight);
      this.labelRenderer?.setSize(window.innerWidth, window.innerHeight);
      this.hudScene.onWindowResize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Update post-processing effects based on weather state
   * Weather modulates saturation, contrast, and vignette for atmospheric mood
   *
   * Clear: Normal values
   * Rain: Slightly desaturated, lower contrast
   * Storm: More desaturated, higher contrast, stronger vignette
   */
  private updateWeatherPostProcessing(): void {
    if (!this.weatherPostProcessingEnabled) return;
    if (!this.hudScene) return;

    const snapshot = this.hudScene.getAtmosphereSnapshot();
    const intensity = snapshot.intensity;
    const stormIntensity = snapshot.stormIntensity;

    if (!this.backend.capabilities.supportsWeatherColorPostFx) {
      return;
    }

    // Store base values on first call if not already stored
    if (this.basePostProcessingValues.saturation === 0 && this.postProcessingConfig) {
      this.basePostProcessingValues.saturation = this.postProcessingConfig.saturation;
      this.basePostProcessingValues.contrast = this.postProcessingConfig.contrast;
      this.basePostProcessingValues.brightness = this.postProcessingConfig.brightness;
      this.basePostProcessingValues.vignetteDarkness = this.postProcessingConfig.vignette.darkness;
    }

    // Calculate weather-modulated values
    // Saturation: reduce during weather (rain/storm feels more muted)
    const saturationReduction = intensity * 0.35 + stormIntensity * 0.15; // Up to -0.5 at full storm
    const targetSaturation = this.basePostProcessingValues.saturation - saturationReduction;

    // Contrast: slightly increase during storms for dramatic effect
    const contrastBoost = stormIntensity * 0.15; // Up to +0.15 during storms
    const targetContrast = this.basePostProcessingValues.contrast + contrastBoost;

    // Brightness: slightly reduce during heavy weather
    const brightnessReduction = intensity * 0.05;
    const targetBrightness = this.basePostProcessingValues.brightness - brightnessReduction;

    // Vignette: increase during storms for tunnel vision effect
    const vignetteIncrease = stormIntensity * 0.2; // Up to +0.2 during storms
    const targetVignette = this.basePostProcessingValues.vignetteDarkness + vignetteIncrease;

    this.postProcessController?.setColorGrade({
      brightness: targetBrightness,
      contrast: targetContrast,
      saturation: targetSaturation,
    });
    this.postProcessController?.setVignette({
      darkness: targetVignette,
    });
  }

  private shouldRenderLabels(now: number): boolean {
    const currentScene = this.sceneManager?.getCurrentScene();
    let view: CameraView | undefined;
    let labelsActive = false;

    if (currentScene === SceneName.WorldMap) {
      view = this.worldmapScene.getCurrentCameraView();
      labelsActive = this.worldmapScene.hasActiveLabelAnimations();
    } else if (currentScene === SceneName.FastTravel && this.fastTravelScene) {
      view = this.fastTravelScene.getCurrentCameraView();
      labelsActive = this.fastTravelScene.hasActiveLabelAnimations();
    } else if (currentScene === SceneName.Hexception) {
      view = this.hexceptionScene.getCurrentCameraView();
      labelsActive = this.hexceptionScene.hasActiveLabelAnimations();
    }

    if (this.hudScene?.hasActiveLabelAnimations()) {
      labelsActive = true;
    }

    const cadenceView = (() => {
      switch (view) {
        case CameraView.Close:
          return "close" as const;
        case CameraView.Medium:
          return "medium" as const;
        case CameraView.Far:
          return "far" as const;
        default:
          return undefined;
      }
    })();

    const decision = resolveLabelRenderDecision({
      now,
      lastLabelRenderTime: this.lastLabelRenderTime,
      labelsDirty: this.labelsDirty,
      lastLabelsActive: this.lastLabelsActive,
      labelsActive,
      intervalMs: resolveLabelRenderIntervalMs(cadenceView, this.isMobileDevice),
    });

    this.labelsDirty = decision.nextLabelsDirty;
    this.lastLabelsActive = decision.nextLastLabelsActive;
    this.lastLabelRenderTime = decision.nextLastLabelRenderTime;

    return decision.shouldRender;
  }

  animate() {
    // Stop animation if renderer has been destroyed
    if (this.isDestroyed) {
      console.log("GameRenderer destroyed, stopping animation loop");
      return;
    }

    if (!this.labelRenderer) {
      requestAnimationFrame(() => {
        this.animate();
      });
      return;
    }

    const currentTime = performance.now();
    if (this.lastTime === 0) {
      this.lastTime = currentTime;
    }

    const targetFPS = this.getTargetFPS();
    if (targetFPS) {
      const frameTime = 1000 / targetFPS;
      if (currentTime - this.lastTime < frameTime) {
        requestAnimationFrame(() => this.animate());
        return;
      }
    }

    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    if (this.stats) this.stats.update();

    if (this.controls) {
      this.controls.update();
    }
    const cycleProgress = useUIStore.getState().cycleProgress || 0;
    this.hudScene.update(deltaTime, cycleProgress);
    const atmosphereSnapshot = this.hudScene.getAtmosphereSnapshot();
    this.worldmapScene.setWeatherAtmosphereState(atmosphereSnapshot);
    this.fastTravelScene?.setWeatherAtmosphereState(atmosphereSnapshot);
    this.hexceptionScene.setWeatherAtmosphereState(atmosphereSnapshot);

    // Render the current game scene
    const isWorldMap = this.sceneManager?.getCurrentScene() === SceneName.WorldMap;
    const isFastTravel = this.sceneManager?.getCurrentScene() === SceneName.FastTravel && Boolean(this.fastTravelScene);
    if (isWorldMap) {
      this.worldmapScene.update(deltaTime);
    } else if (isFastTravel && this.fastTravelScene) {
      this.fastTravelScene.update(deltaTime);
    } else {
      this.hexceptionScene.update(deltaTime);
    }
    const activeScene = isWorldMap
      ? this.worldmapScene.getScene()
      : isFastTravel
        ? (this.fastTravelScene?.getScene() ?? this.worldmapScene.getScene())
        : this.hexceptionScene.getScene();

    const shouldRenderLabels = this.shouldRenderLabels(currentTime);
    if (shouldRenderLabels) {
      this.labelRenderer.render(activeScene, this.camera);
    }
    renderRendererBackendFrame(this.backend, {
      mainCamera: this.camera,
      mainScene: activeScene,
      overlayCamera: this.hudScene.getCamera(),
      overlayScene: this.hudScene.getScene(),
      sceneName: this.sceneManager?.getCurrentScene(),
    });
    setRendererDiagnosticSceneName(this.sceneManager?.getCurrentScene() ?? "unknown");
    if (shouldRenderLabels) {
      this.labelRenderer.render(this.hudScene.getScene(), this.hudScene.getCamera());
    }

    // Update post-processing based on weather state
    this.updateWeatherPostProcessing();

    // Capture stats sample AFTER rendering (to get accurate draw call/triangle counts)
    this.captureStatsSample();

    requestAnimationFrame(() => {
      this.animate();
    });
  }

  private isDestroyed = false;

  public destroy(): void {
    // Prevent multiple destroy calls
    if (this.isDestroyed) {
      console.warn("GameRenderer already destroyed, skipping cleanup");
      return;
    }

    this.isDestroyed = true;

    try {
      // Clean up memory monitor timeout
      if (this.memoryMonitorTimeoutId) {
        clearTimeout(this.memoryMonitorTimeoutId);
        this.memoryMonitorTimeoutId = undefined;
      }

      if (this.unsubscribeEnableMapZoom) {
        this.unsubscribeEnableMapZoom();
        this.unsubscribeEnableMapZoom = undefined;
      }

      if (this.unsubscribeQualityController) {
        this.unsubscribeQualityController();
        this.unsubscribeQualityController = undefined;
      }

      // Clean up intervals
      if (this.cleanupIntervals) {
        this.cleanupIntervals.forEach((interval) => clearInterval(interval));
        this.cleanupIntervals = [];
      }

      // Clean up renderer resources
      if (this.renderer?.domElement && this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
      if (this.backend) {
        disposeRendererBackend(this.backend);
      }

      // Clean up scenes
      if (this.worldmapScene && typeof this.worldmapScene.destroy === "function") {
        this.worldmapScene.destroy();
      }
      if (this.fastTravelScene && typeof this.fastTravelScene.destroy === "function") {
        this.fastTravelScene.destroy();
      }
      if (this.hexceptionScene && typeof this.hexceptionScene.destroy === "function") {
        this.hexceptionScene.destroy();
      }
      if (this.hudScene && typeof this.hudScene.destroy === "function") {
        this.hudScene.destroy();
      }

      // Clean up controls
      if (this.controls) {
        this.controls.dispose();
      }

      if (this.transitionManager && typeof this.transitionManager.destroy === "function") {
        this.transitionManager.destroy();
      }

      destroyTrackedGuiFolders(this.guiFolders ?? []);

      // Remove event listeners
      window.removeEventListener("urlChanged", this.handleURLChange);
      window.removeEventListener("popstate", this.handleURLChange);
      window.removeEventListener("resize", this.handleWindowResize);
      document.removeEventListener("focus", this.handleDocumentFocus, true);
      document.removeEventListener("blur", this.handleDocumentBlur, true);

      // Clean up memory monitoring
      clearGameRendererDebugGlobals(window);
      if (this.memoryStatsElement && this.memoryStatsElement.parentNode) {
        this.memoryStatsElement.parentNode.removeChild(this.memoryStatsElement);
      }
      if (this.statsDomElement && this.statsDomElement.parentNode) {
        this.statsDomElement.parentNode.removeChild(this.statsDomElement);
        this.statsDomElement = undefined;
      }
      if (this.labelRendererElement) {
        this.labelRendererElement.replaceChildren();
      }

      // Clean up stats recording
      if (this.statsRecordingIndicator) {
        this.statsRecordingIndicator.remove();
      }
      const pulseStyle = document.getElementById("stats-recording-pulse");
      if (pulseStyle) pulseStyle.remove();
      const keyHandler = (this as any)._statsRecordingKeyHandler;
      if (keyHandler) {
        window.removeEventListener("keydown", keyHandler);
      }

      console.log("GameRenderer: Destroyed and cleaned up successfully");
    } catch (error) {
      console.error("Error during GameRenderer cleanup:", error);
    }
  }
  private subscribeToQualityController(): void {
    if (this.unsubscribeQualityController) {
      return;
    }
    this.unsubscribeQualityController = qualityController.addEventListener((event) => {
      this.applyQualityFeatures(event.currentFeatures);
    });
  }

  private applyQualityFeatures(features: QualityFeatures): void {
    this.lastAppliedQuality = { ...features };

    const devicePixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    const resolvedPixelRatio = this.resolvePixelRatio(Math.min(devicePixelRatio, features.pixelRatio));
    applyRendererBackendQuality(this.backend, {
      pixelRatio: resolvedPixelRatio,
      shadows: features.shadows,
      width: window.innerWidth,
      height: window.innerHeight,
    });

    if (this.postProcessingConfig) {
      this.rebuildPostProcessing(features);
    } else {
      setRendererDiagnosticDegradations([]);
    }

    this.worldmapScene?.applyQualityFeatures(features);
    this.fastTravelScene?.applyQualityFeatures(features);
    this.hexceptionScene?.applyQualityFeatures(features);

  }

  private rebuildPostProcessing(features: QualityFeatures): void {
    if (!this.postProcessingConfig) {
      return;
    }

    const effectPlan = resolvePostProcessingEffectPlan({
      fxaa: features.fxaa,
      bloom: features.bloom,
      chromaticAberration: features.chromaticAberration,
      vignette: features.vignette,
    });

    const rendererPlan = resolveCapabilityAwareRendererEffectPlan({
      antiAlias: effectPlan.shouldEnableFXAA ? "fxaa" : "none",
      bloomEnabled: effectPlan.shouldEnableBloom,
      bloomIntensity: features.bloomIntensity,
      capabilities: this.backend.capabilities,
      chromaticAberrationEnabled: effectPlan.shouldEnableChromaticAberration,
      colorGrade: {
        brightness: this.postProcessingConfig.brightness,
        contrast: this.postProcessingConfig.contrast,
        hue: this.postProcessingConfig.hue,
        saturation: this.postProcessingConfig.saturation,
      },
      disabledReasons: {
        bloom: features.bloom ? undefined : "disabled-by-quality",
        chromaticAberration: features.chromaticAberration ? undefined : "disabled-by-quality",
        vignette: features.vignette ? undefined : "disabled-by-quality",
      },
      toneMapping: {
        exposure: this.postProcessingConfig.toneMapping.exposure,
        mode: this.resolveRendererToneMappingMode(this.postProcessingConfig.toneMapping.mode),
        whitePoint: this.postProcessingConfig.toneMapping.whitePoint,
      },
      vignette: {
        darkness: this.postProcessingConfig.vignette.darkness,
        enabled: effectPlan.shouldEnableVignette,
        offset: this.postProcessingConfig.vignette.offset,
      },
    });

    this.postProcessController = applyRendererBackendPostProcessPlan(this.backend, rendererPlan.plan);
    replaceRendererDiagnosticDegradations(
      ["colorGrade", "bloom", "vignette", "chromaticAberration"],
      rendererPlan.degradations,
    );
    setRendererDiagnosticEffectPlan(rendererPlan.plan);
    setRendererDiagnosticPostprocessPolicy(
      resolveWebgpuPostprocessPolicy({
        activeMode: snapshotRendererDiagnostics().activeMode ?? "legacy-webgl",
        capabilities: this.backend.capabilities,
      }),
    );
  }

  private async requestScenePrewarm(
    scene:
      | {
          getCamera(): unknown;
          getScene(): unknown;
        }
      | undefined,
  ): Promise<void> {
    if (!scene || !this.backend?.renderer) {
      return;
    }

    try {
      await requestRendererScenePrewarm(this.backend.renderer, scene.getScene(), scene.getCamera());
    } catch (error) {
      console.warn("GameRenderer: Scene prewarm failed", error);
    }
  }

  private resolveRendererToneMappingMode(
    mode: ToneMappingMode,
  ): RendererPostProcessPlan["toneMapping"]["mode"] {
    switch (mode) {
      case ToneMappingMode.ACES_FILMIC:
        return "aces-filmic";
      case ToneMappingMode.LINEAR:
        return "linear";
      case ToneMappingMode.NEUTRAL:
        return "neutral";
      case ToneMappingMode.REINHARD:
        return "reinhard";
      case ToneMappingMode.CINEON:
      case ToneMappingMode.OPTIMIZED_CINEON:
      default:
        return "cineon";
    }
  }
}
