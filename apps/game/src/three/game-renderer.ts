import { useUIStore } from "@/hooks/store/use-ui-store";
import { DEV_MODE_ENABLED } from "@/utils/dev-mode";
import { getGameModeId } from "@/config/game-modes";
import { GRAPHICS_DEV_GUI_ENABLED, createGuiFolder } from "@/three/utils/gui-manager";
import { IS_MOBILE } from "@/ui/config";
import { SetupResult } from "@bibliothecadao/dojo";
import { env } from "../../env";
import { recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
import { SceneName } from "./types";
import { configureGltfTextureSupport, transitionDB } from "./utils/";
import { trackGuiFolder, type TrackableGuiFolder } from "./utils/gui-folder-lifecycle";
import {
  createRendererFrameFailureCircuit,
  resolveRendererPacedFps,
  runRendererAnimationTick,
  type RendererFrameFailureCircuit,
} from "./renderer-animation-runtime";
import {
  resolveRendererPixelRatioCap,
  resolveRendererTargetPixelRatio,
  resizeRendererDisplay,
} from "./renderer-display-runtime";
import { type RendererBackendFactory, type RendererSurfaceLike } from "./renderer-backend";
import { disposeRendererBackend } from "./renderer-backend-compat";
import {
  initializeRendererBackendRuntime,
  initializeRendererDeviceLossFallbackRuntime,
} from "./renderer-backend-runtime";
import { createRendererFoundationRuntime } from "./renderer-foundation-runtime";
import { runRendererFrame } from "./renderer-frame-runtime";
import { discardGpuBackendFrame, startGpuBackendFrame } from "./gpu-backend-hot-path-instrumentation";
import type { RendererInteractionRuntime } from "./renderer-interaction-runtime";
import type { RendererLabelRuntime } from "./renderer-label-runtime";
import { renderProfile } from "./render-profile";
import { prepareGameRendererScenes } from "./renderer-scene-orchestration";
import { destroyRendererRuntime } from "./renderer-destroy-runtime";
import { bootstrapRendererStartupRuntime } from "./renderer-startup-runtime";
import { resolveRendererRouteSceneFromHref } from "./renderer-route-runtime";
import type { RendererSessionRuntime } from "./renderer-session-runtime";
import type { RendererSupportRuntimeRegistry } from "./renderer-support-runtime-registry";
import type { RendererBackendV2, RendererDeviceLostEvent } from "./renderer-backend-v2";
import { createGameRendererRuntimeAssembly, type GameRendererRuntimeState } from "./game-renderer-runtime-assembly";
import { getRendererDiagnosticActiveMode } from "./renderer-diagnostics";
import {
  reportRendererDeviceLoss,
  reportRendererFrameFailure,
  reportRendererRecoveryFailure,
} from "./renderer-failure-reporting";
import type { SceneManager } from "@/three/scene-manager";
import type HUDScene from "@/three/scenes/hud-scene";
import type FastTravelScene from "@/three/scenes/fast-travel";
import type HexceptionScene from "@/three/scenes/hexception";
import type WorldmapScene from "@/three/scenes/worldmap";
import type { TransitionManager } from "@/three/managers/transition-manager";
import { createPipelineCompiler } from "@/three/pipeline-compiler";

const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;
const GRAPHICS_DEV_ENABLED = DEV_MODE_ENABLED;

type RendererBackendRuntime = RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
type ReconnectableRendererControls = NonNullable<RendererInteractionRuntime["controls"]> & {
  connect?: (surface: HTMLElement) => void;
  disconnect?: () => void;
  listenToKeyEvents?: (surface: HTMLElement) => void;
};

export default class GameRenderer {
  private labelRuntime!: RendererLabelRuntime;
  private readonly sessionRuntime: RendererSessionRuntime<HUDScene>;
  private readonly supportRuntimeRegistry: RendererSupportRuntimeRegistry;
  private backend!: RendererBackendRuntime;
  private renderer!: RendererSurfaceLike;
  private interactionRuntime!: RendererInteractionRuntime;
  private camera!: RendererInteractionRuntime["camera"];
  // Reads the live backend at call time: the backend can be replaced after a device loss.
  private readonly pipelineCompiler = createPipelineCompiler({
    getRenderer: () => this.backend?.renderer,
    getCamera: () => this.camera,
  });
  private raycaster!: RendererInteractionRuntime["raycaster"];
  private mouse!: RendererInteractionRuntime["pointer"];
  private controls!: NonNullable<RendererInteractionRuntime["controls"]>;

  // Components
  private transitionManager!: TransitionManager;

  // Scenes
  private worldmapScene!: WorldmapScene;
  private fastTravelScene?: FastTravelScene;
  private hexceptionScene!: HexceptionScene;
  private hudScene!: HUDScene;

  private lastTime: number = 0;
  private animationFrameHandle: number | null = null;
  private isAnimationLoopRunning = false;
  private lastInteractionTime = performance.now();
  private dojo: SetupResult;
  private sceneManager!: SceneManager;
  private cleanupIntervals: NodeJS.Timeout[] = [];
  private guiFolders: TrackableGuiFolder[] = [];
  private readonly isMobileDevice = IS_MOBILE;
  private backendInitializationPromise?: Promise<void>;
  private hasRecoveredFromDeviceLoss = false;
  private isRecoveringFromDeviceLoss = false;
  private isRendererRecoveryPaused = false;
  private rendererFrameFailureCircuit?: RendererFrameFailureCircuit;
  private readonly handleWindowResize = () => this.onWindowResize();

  constructor(dojoContext: SetupResult) {
    this.dojo = dojoContext;

    const runtimeAssembly = createGameRendererRuntimeAssembly({
      addWindowListener: (type, listener) => window.addEventListener(type, listener),
      createFolder: (name) => trackGuiFolder(this.guiFolders, createGuiFolder(name)),
      fastTravelEnabled: () => this.isFastTravelEnabled(),
      isGraphicsDevEnabled: !!GRAPHICS_DEV_ENABLED,
      isMemoryMonitoringEnabled: MEMORY_MONITORING_ENABLED,
      isMobileDevice: this.isMobileDevice,
      rendererOwner: this,
      resolvePixelRatio: (pixelRatio) => this.resolvePixelRatio(pixelRatio),
      resolveRuntimeState: () => this.resolveRuntimeState(),
      windowObject: window,
      windowResizeListener: this.handleWindowResize,
    });
    this.supportRuntimeRegistry = runtimeAssembly.supportRuntimeRegistry;
    this.sessionRuntime = runtimeAssembly.sessionRuntime;
    this.backendInitializationPromise = this.initializeRendererBackend();
    this.initializeFoundationRuntime();
  }

  private resolveRuntimeState(): GameRendererRuntimeState {
    return {
      backend: this.backend,
      controls: this.controls,
      fastTravelScene: this.fastTravelScene,
      hexceptionScene: this.hexceptionScene,
      hudScene: this.hudScene,
      labelRuntime: this.labelRuntime,
      renderer: this.renderer,
      sceneManager: this.sceneManager,
      transitionManager: this.transitionManager,
      worldmapScene: this.worldmapScene,
    };
  }

  private initializeFoundationRuntime() {
    const foundationRuntime = createRendererFoundationRuntime({
      isMobileDevice: this.isMobileDevice,
      onControlsChange: () => {
        this.markRendererInteraction();
        this.supportRuntimeRegistry.getControlBridge().handleInteractionChange();
      },
      onInteraction: () => this.markRendererInteraction(),
      warn: (message, error) => console.warn(message, error),
    });

    this.interactionRuntime = foundationRuntime.interactionRuntime;
    this.labelRuntime = foundationRuntime.labelRuntime;
    this.camera = foundationRuntime.camera;
    this.raycaster = foundationRuntime.raycaster;
    this.mouse = foundationRuntime.pointer;
  }

  private isFastTravelEnabled(): boolean {
    return getGameModeId() !== "blitz";
  }

  private async initializeRendererBackend(backendFactory?: RendererBackendFactory): Promise<void> {
    const { backend, renderer } = await initializeRendererBackendRuntime({
      backendFactory,
      envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
      isMobileDevice: this.isMobileDevice,
      onDeviceLost: (event) => this.handleRendererDeviceLost(event),
      pixelRatio: this.getTargetPixelRatio(),
      search: window.location.search,
    });
    this.backend = backend as RendererBackendRuntime;
    this.renderer = renderer;
    configureGltfTextureSupport(renderer as Parameters<typeof configureGltfTextureSupport>[0]);
  }

  private handleRendererDeviceLost(event: RendererDeviceLostEvent): void {
    reportRendererDeviceLoss(event, {
      recoveryAttempted: this.shouldStartDeviceLossFallback(),
    });
    void this.recoverFromRendererDeviceLoss(event);
  }

  private async recoverFromRendererDeviceLoss(event: RendererDeviceLostEvent): Promise<void> {
    if (!this.shouldStartDeviceLossFallback()) {
      return;
    }

    const previousBackend = this.backend;
    this.beginDeviceLossFallback();

    try {
      const fallbackRuntime = await this.initializeDeviceLossFallbackBackend();
      if (this.isDestroyed) {
        disposeRendererBackend(fallbackRuntime.backend);
        return;
      }

      this.installDeviceLossFallbackBackend({
        backend: fallbackRuntime.backend,
        previousBackend,
        renderer: fallbackRuntime.renderer,
      });
      this.resumeRendererAfterDeviceLossFallback();
    } catch (error) {
      this.handleDeviceLossFallbackFailure(error, event.activeMode);
    }
  }

  private shouldStartDeviceLossFallback(): boolean {
    return !this.isDestroyed && !this.isRecoveringFromDeviceLoss && !this.hasRecoveredFromDeviceLoss;
  }

  private beginDeviceLossFallback(): void {
    this.isRecoveringFromDeviceLoss = true;
    this.isRendererRecoveryPaused = true;
    discardGpuBackendFrame();
  }

  private async initializeDeviceLossFallbackBackend(): Promise<{
    backend: RendererBackendRuntime;
    renderer: RendererSurfaceLike;
  }> {
    return initializeRendererDeviceLossFallbackRuntime({
      envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
      isMobileDevice: this.isMobileDevice,
      pixelRatio: this.getTargetPixelRatio(),
      search: window.location.search,
    });
  }

  private installDeviceLossFallbackBackend(input: {
    backend: RendererBackendRuntime;
    previousBackend?: RendererBackendRuntime;
    renderer: RendererSurfaceLike;
  }): void {
    const shouldRestoreMonitoring = Boolean(this.supportRuntimeRegistry.getMonitoring());

    this.backend = input.backend;
    this.renderer = input.renderer;
    configureGltfTextureSupport(input.renderer as Parameters<typeof configureGltfTextureSupport>[0]);
    this.mountRecoveredRendererSurface(input.renderer.domElement);
    this.reconnectRendererControlsToSurface(input.renderer.domElement);
    this.reattachSceneInputSurfaces(input.renderer.domElement);
    this.resetBackendDependentSupportRuntimes(shouldRestoreMonitoring);
    this.disposePreviousRendererBackend(input.previousBackend);
    this.onWindowResize();
  }

  private mountRecoveredRendererSurface(surface: HTMLElement): void {
    document.body.style.background = "black";
    surface.id = "main-canvas";

    const currentSurface = document.getElementById("main-canvas");
    if (currentSurface && currentSurface !== surface) {
      currentSurface.replaceWith(surface);
      return;
    }

    if (!surface.isConnected) {
      document.body.appendChild(surface);
    }
  }

  private reconnectRendererControlsToSurface(surface: HTMLElement): void {
    const controls = this.controls as ReconnectableRendererControls | undefined;
    if (!controls) {
      return;
    }

    if (!controls.disconnect || !controls.connect) {
      console.warn("[GameRenderer] Renderer controls cannot reconnect to the replacement canvas");
      return;
    }

    controls.disconnect();
    controls.connect(surface);
    controls.listenToKeyEvents?.(document.body);
  }

  private reattachSceneInputSurfaces(surface: HTMLElement): void {
    this.worldmapScene?.setInputSurface(surface);
    this.fastTravelScene?.setInputSurface(surface);
    this.hexceptionScene?.setInputSurface(surface);
  }

  private resetBackendDependentSupportRuntimes(shouldRestoreMonitoring: boolean): void {
    this.supportRuntimeRegistry.resetEffectsBridge();
    if (shouldRestoreMonitoring) {
      this.supportRuntimeRegistry.resetMonitoring();
      this.sessionRuntime.initializeMonitoring();
    }

    if (!this.hasPreparedRendererScenes()) {
      return;
    }

    const effectsBridgeRuntime = this.supportRuntimeRegistry.ensureEffectsBridge();
    effectsBridgeRuntime.applyEnvironment();
    effectsBridgeRuntime.setupPostProcessingEffects();
    effectsBridgeRuntime.applyRenderVisualProfile(renderProfile.visuals);
    effectsBridgeRuntime.updateWeatherPostProcessing();
  }

  private disposePreviousRendererBackend(previousBackend?: RendererBackendRuntime): void {
    if (!previousBackend || previousBackend === this.backend) {
      return;
    }

    disposeRendererBackend(previousBackend);
  }

  private resumeRendererAfterDeviceLossFallback(): void {
    this.hasRecoveredFromDeviceLoss = true;
    this.isRecoveringFromDeviceLoss = false;
    this.isRendererRecoveryPaused = false;
    this.lastTime = 0;

    if (this.hasPreparedRendererScenes()) {
      this.animate();
    }
  }

  private handleDeviceLossFallbackFailure(error: unknown, lostMode: RendererDeviceLostEvent["activeMode"]): void {
    this.isRecoveringFromDeviceLoss = false;
    this.isRendererRecoveryPaused = false;
    this.lastTime = 0;
    reportRendererRecoveryFailure(error, lostMode);

    if (!this.isDestroyed && this.hasPreparedRendererScenes()) {
      this.animate();
    }
  }

  private hasPreparedRendererScenes(): boolean {
    return Boolean(this.sceneManager && this.worldmapScene && this.hexceptionScene && this.hudScene);
  }

  initStats() {
    this.sessionRuntime.initializeMonitoring();
  }

  // Stats Recording — delegated to StatsRecorder
  public startStatsRecording() {
    this.sessionRuntime.startStatsRecording();
  }

  public stopStatsRecording() {
    return this.sessionRuntime.stopStatsRecording();
  }

  public exportStatsRecording() {
    this.sessionRuntime.exportStatsRecording();
  }

  async initScene() {
    // Each `recordGameEntryDuration` call below surfaces in the boot debug
    // panel as `renderer-init-<step>` so a slow cold-reload pinpoints the
    // exact sub-step (backend handshake vs scene construction vs HUD vs
    // animate kickoff) instead of being hidden inside the `renderer-init`
    // aggregate.
    const backendStart = performance.now();
    await this.backendInitializationPromise;
    recordGameEntryDuration("renderer-init-backend-await", performance.now() - backendStart);

    if (this.isDestroyed) {
      return;
    }
    if (GRAPHICS_DEV_GUI_ENABLED) {
      this.supportRuntimeRegistry.getControlBridge().setupGuiControls();
    }
    this.sessionRuntime.startListeners();
    const initialSceneName = resolveRendererRouteSceneFromHref({
      fastTravelEnabled: this.isFastTravelEnabled(),
      href: window.location.href,
    });

    const measure = (label: string, fn: () => void) => {
      const start = performance.now();
      fn();
      recordGameEntryDuration(`renderer-init-${label}`, performance.now() - start);
    };

    bootstrapRendererStartupRuntime({
      animate: () => measure("animate-start", () => this.animate()),
      attachInteractionRuntime: () => measure("attach-interaction", () => this.attachInteractionRuntime()),
      cleanupExpiredTransitions: (maxAgeMs) => transitionDB.cleanupExpired(maxAgeMs),
      debug: (message) => {
        if (import.meta.env.DEV) console.debug(message);
      },
      document,
      initializeHudScene: () =>
        measure("hud-scene", () => {
          this.hudScene = this.sessionRuntime.createHudScene();
        }),
      initialSceneName,
      isDestroyed: this.isDestroyed,
      prepareScenes: () => measure("prepare-scenes", () => this.prepareScenes()),
      registerCleanupInterval: (intervalId) => {
        this.cleanupIntervals = this.cleanupIntervals || [];
        this.cleanupIntervals.push(intervalId);
      },
      rendererDomElement: this.renderer.domElement,
      syncRouteFromLocation: () => measure("sync-route", () => this.sessionRuntime.syncRouteFromLocation()),
      warn: (message) => console.warn(message),
    });
  }

  private attachInteractionRuntime() {
    if (!this.interactionRuntime) {
      this.initializeFoundationRuntime();
    }

    this.interactionRuntime.attachSurface(this.renderer.domElement);
    if (!this.interactionRuntime.controls) {
      throw new Error("GameRenderer: Failed to attach renderer interaction runtime");
    }

    this.controls = this.interactionRuntime.controls;
  }

  prepareScenes() {
    prepareGameRendererScenes({
      applySceneRegistry: (registry) => this.assignRendererSceneRegistry(registry),
      controls: this.controls,
      dojo: this.dojo,
      effectsBridgeRuntime: this.supportRuntimeRegistry.ensureEffectsBridge(),
      fastTravelEnabled: this.isFastTravelEnabled(),
      inputSurface: this.renderer.domElement,
      compilePipelines: this.pipelineCompiler,
      markLabelsDirty: () => this.labelRuntime?.markDirty(),
      mouse: this.mouse,
      renderVisuals: renderProfile.visuals,
      raycaster: this.raycaster,
    });
  }

  private assignRendererSceneRegistry(input: {
    fastTravelScene?: FastTravelScene;
    hexceptionScene: HexceptionScene;
    sceneManager: SceneManager;
    transitionManager: TransitionManager;
    worldmapScene: WorldmapScene;
  }) {
    this.transitionManager = input.transitionManager;
    this.sceneManager = input.sceneManager;
    this.worldmapScene = input.worldmapScene;
    this.hexceptionScene = input.hexceptionScene;
    this.fastTravelScene = input.fastTravelScene;
  }
  private getTargetPixelRatio() {
    return resolveRendererTargetPixelRatio({
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  }

  public resolvePixelRatio(pixelRatio: number): number {
    return Math.min(pixelRatio, resolveRendererPixelRatioCap());
  }

  private markRendererInteraction(): void {
    this.lastInteractionTime = performance.now();
  }

  private getTargetFps(): number | null {
    return resolveRendererPacedFps({
      currentTime: performance.now(),
      lastInteractionTime: this.lastInteractionTime,
      profile: renderProfile,
    });
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
    resizeRendererDisplay({
      backend: this.backend,
      camera: this.camera,
      getContainer: () => document.getElementById("three-container"),
      hudScene: this.hudScene,
      labelRuntime: this.labelRuntime,
      markLabelsDirty: () => this.supportRuntimeRegistry.getControlBridge().markLabelsDirty(),
      windowHeight: window.innerHeight,
      windowWidth: window.innerWidth,
    });
  }

  animate() {
    if (this.isAnimationLoopRunning) {
      return;
    }

    this.isAnimationLoopRunning = true;
    this.runAnimationFrame();
  }

  private runAnimationFrame(): void {
    const shouldStopAnimationLoop = this.shouldStopAnimationLoop();
    if (!shouldStopAnimationLoop) {
      startGpuBackendFrame();
    }

    this.lastTime = runRendererAnimationTick({
      getCurrentTime: () => performance.now(),
      getCycleProgress: () => useUIStore.getState().cycleProgress || 0,
      isDestroyed: shouldStopAnimationLoop,
      isLabelRuntimeReady: this.labelRuntime?.isReady() ?? false,
      lastTime: this.lastTime,
      logDestroyed: (message) => {
        if (this.isDestroyed) {
          console.warn(message);
        }
      },
      onFrameError: (error) => this.handleRendererFrameError(error),
      onFrameSuccess: () => this.getRendererFrameFailureCircuit().recordSuccess(),
      renderFrame: ({ currentTime, cycleProgress, deltaTime }) => {
        const rendered = runRendererFrame({
          backend: this.backend,
          camera: this.camera,
          captureStatsSample: () => this.sessionRuntime.captureStatsSample(),
          currentScene: this.sceneManager?.getCurrentScene(),
          currentTime,
          cycleProgress,
          deltaTime,
          fastTravelScene: this.fastTravelScene,
          hexceptionScene: this.hexceptionScene,
          hudScene: this.hudScene,
          labelRuntime: this.labelRuntime,
          effectsBridgeRuntime: this.supportRuntimeRegistry.getEffectsBridge(),
          worldmapScene: this.worldmapScene,
        });

        return rendered;
      },
      requestNextFrame: () => this.scheduleNextAnimationFrame(),
      targetFPS: this.getTargetFps(),
      updateControls: () => {
        this.controls?.update();
      },
      updateStatsPanel: () => this.sessionRuntime.updateStatsPanel(),
    });

    if (shouldStopAnimationLoop) {
      this.stopAnimationLoop();
    }
  }

  private scheduleNextAnimationFrame(): void {
    if (!this.isAnimationLoopRunning || typeof this.animationFrameHandle === "number") {
      return;
    }

    this.animationFrameHandle = requestAnimationFrame(() => {
      this.animationFrameHandle = null;
      if (this.isAnimationLoopRunning) {
        this.runAnimationFrame();
      }
    });
  }

  private stopAnimationLoop(): void {
    if (typeof this.animationFrameHandle === "number") {
      cancelAnimationFrame(this.animationFrameHandle);
      this.animationFrameHandle = null;
    }
    this.isAnimationLoopRunning = false;
  }

  private handleRendererFrameError(error: unknown): void {
    discardGpuBackendFrame();
    const failure = this.getRendererFrameFailureCircuit().recordFailure(error);
    if (!failure.shouldReport) {
      return;
    }

    reportRendererFrameFailure(error, {
      activeMode: getRendererDiagnosticActiveMode(),
      repeatCount: failure.repeatCount,
      sceneName: this.sceneManager?.getCurrentScene(),
    });
  }

  private getRendererFrameFailureCircuit(): RendererFrameFailureCircuit {
    this.rendererFrameFailureCircuit ??= createRendererFrameFailureCircuit();
    return this.rendererFrameFailureCircuit;
  }

  private isDestroyed = false;

  private shouldStopAnimationLoop(): boolean {
    return this.isDestroyed || this.isRendererRecoveryPaused;
  }

  public destroy(): void {
    // Prevent multiple destroy calls
    if (this.isDestroyed) {
      console.warn("GameRenderer already destroyed, skipping cleanup");
      return;
    }

    this.isDestroyed = true;
    this.stopAnimationLoop();
    discardGpuBackendFrame();

    destroyRendererRuntime({
      backend: this.backend,
      cleanupIntervals: this.cleanupIntervals,
      controls: this.controls,
      effectsBridgeRuntime: this.supportRuntimeRegistry.getEffectsBridge(),
      guiFolders: this.guiFolders ?? [],
      handleWindowResize: this.handleWindowResize,
      interactionRuntime: this.interactionRuntime,
      labelRuntime: this.labelRuntime,
      monitoringRuntime: this.supportRuntimeRegistry.getMonitoring(),
      removeWindowListener: (type, listener) => window.removeEventListener(type, listener),
      renderer: this.renderer,
      routeRuntime: this.supportRuntimeRegistry.getRoute(),
      scenes: {
        fastTravelScene: this.fastTravelScene,
        hexceptionScene: this.hexceptionScene,
        hudScene: this.hudScene,
        worldmapScene: this.worldmapScene,
      },
      transitionManager: this.transitionManager,
    });
  }
}
