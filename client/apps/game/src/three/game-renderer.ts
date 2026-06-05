import { useUIStore } from "@/hooks/store/use-ui-store";
import { getGameModeId } from "@/config/game-modes";
import { GRAPHICS_DEV_GUI_ENABLED, createGuiFolder } from "@/three/utils/gui-manager";
import { GRAPHICS_SETTING, GraphicsSettings, IS_MOBILE } from "@/ui/config";
import { SetupResult } from "@bibliothecadao/dojo";
import { env } from "../../env";
import { recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
import { SceneName } from "./types";
import { transitionDB } from "./utils/";
import { trackGuiFolder, type TrackableGuiFolder } from "./utils/gui-folder-lifecycle";
import { runRendererAnimationTick } from "./renderer-animation-runtime";
import {
  resolveRendererPixelRatioCap,
  resolveRendererTargetFps,
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
import type { RendererInteractionRuntime } from "./renderer-interaction-runtime";
import type { RendererLabelRuntime } from "./renderer-label-runtime";
import { qualityController } from "./utils/quality-controller";
import { prepareGameRendererScenes } from "./renderer-scene-orchestration";
import { destroyRendererRuntime } from "./renderer-destroy-runtime";
import { bootstrapRendererStartupRuntime } from "./renderer-startup-runtime";
import { resolveRendererRouteSceneFromHref } from "./renderer-route-runtime";
import type { RendererSessionRuntime } from "./renderer-session-runtime";
import type { RendererSupportRuntimeRegistry } from "./renderer-support-runtime-registry";
import type { RendererBackendV2, RendererDeviceLostEvent } from "./renderer-backend-v2";
import { createGameRendererRuntimeAssembly, type GameRendererRuntimeState } from "./game-renderer-runtime-assembly";
import type { SceneManager } from "@/three/scene-manager";
import type HUDScene from "@/three/scenes/hud-scene";
import type FastTravelScene from "@/three/scenes/fast-travel";
import type HexceptionScene from "@/three/scenes/hexception";
import type WorldmapScene from "@/three/scenes/worldmap";
import type { TransitionManager } from "@/three/managers/transition-manager";

const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;
const GRAPHICS_DEV_ENABLED = env.VITE_PUBLIC_GRAPHICS_DEV;

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
  private dojo: SetupResult;
  private sceneManager!: SceneManager;
  private graphicsSetting: GraphicsSettings;
  private cleanupIntervals: NodeJS.Timeout[] = [];
  private guiFolders: TrackableGuiFolder[] = [];
  private readonly isMobileDevice = IS_MOBILE;
  private backendInitializationPromise?: Promise<void>;
  private hasRecoveredFromDeviceLoss = false;
  private isRecoveringFromDeviceLoss = false;
  private isRendererRecoveryPaused = false;
  private readonly handleWindowResize = () => this.onWindowResize();

  constructor(dojoContext: SetupResult) {
    this.graphicsSetting = GRAPHICS_SETTING;
    this.dojo = dojoContext;

    const runtimeAssembly = createGameRendererRuntimeAssembly({
      addWindowListener: (type, listener) => window.addEventListener(type, listener),
      createFolder: (name) => trackGuiFolder(this.guiFolders, createGuiFolder(name)),
      fastTravelEnabled: () => this.isFastTravelEnabled(),
      graphicsSetting: this.graphicsSetting,
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
      graphicsSetting: this.graphicsSetting,
      isMobileDevice: this.isMobileDevice,
      onControlsChange: () => this.supportRuntimeRegistry.getControlBridge().handleInteractionChange(),
      resolveCurrentSceneName: () => this.sceneManager?.getCurrentScene(),
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
      graphicsSetting: this.graphicsSetting,
      isMobileDevice: this.isMobileDevice,
      onDeviceLost: (event) => this.handleRendererDeviceLost(event),
      pixelRatio: this.getTargetPixelRatio(),
      search: window.location.search,
    });
    this.backend = backend as RendererBackendRuntime;
    this.renderer = renderer;
  }

  private handleRendererDeviceLost(event: RendererDeviceLostEvent): void {
    void this.recoverFromRendererDeviceLoss(event);
  }

  private async recoverFromRendererDeviceLoss(_event: RendererDeviceLostEvent): Promise<void> {
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
      this.handleDeviceLossFallbackFailure(error);
    }
  }

  private shouldStartDeviceLossFallback(): boolean {
    return !this.isDestroyed && !this.isRecoveringFromDeviceLoss && !this.hasRecoveredFromDeviceLoss;
  }

  private beginDeviceLossFallback(): void {
    this.isRecoveringFromDeviceLoss = true;
    this.isRendererRecoveryPaused = true;
  }

  private async initializeDeviceLossFallbackBackend(): Promise<{
    backend: RendererBackendRuntime;
    renderer: RendererSurfaceLike;
  }> {
    return initializeRendererDeviceLossFallbackRuntime({
      envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
      graphicsSetting: this.graphicsSetting,
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
    effectsBridgeRuntime.applyQualityFeatures(qualityController.getFeatures());
    effectsBridgeRuntime.subscribeToQualityController();
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

  private handleDeviceLossFallbackFailure(error: unknown): void {
    this.isRecoveringFromDeviceLoss = false;
    console.error("[GameRenderer] Failed to recover from WebGPU device loss", error);
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
      debug: (message) => console.debug(message),
      document,
      initializeHudScene: () =>
        measure("hud-scene", () => {
          this.hudScene = this.sessionRuntime.createHudScene();
        }),
      initialSceneName,
      isDestroyed: this.isDestroyed,
      prepareScenes: (sceneName) => measure("prepare-scenes", () => this.prepareScenes(sceneName)),
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

  prepareScenes(initialSceneName: SceneName) {
    prepareGameRendererScenes({
      applySceneRegistry: (registry) => this.assignRendererSceneRegistry(registry),
      controls: this.controls,
      dojo: this.dojo,
      effectsBridgeRuntime: this.supportRuntimeRegistry.ensureEffectsBridge(),
      fastTravelEnabled: this.isFastTravelEnabled(),
      initialSceneName,
      inputSurface: this.renderer.domElement,
      markLabelsDirty: () => this.labelRuntime?.markDirty(),
      mouse: this.mouse,
      qualityFeatures: qualityController.getFeatures(),
      raycaster: this.raycaster,
      renderer: this.backend?.renderer,
      warn: (message, error) => console.warn(message, error),
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
      graphicsSetting: this.graphicsSetting,
      isMobileDevice: this.isMobileDevice,
    });
  }

  private getTargetFPS(): number | null {
    return resolveRendererTargetFps({
      graphicsSetting: this.graphicsSetting,
      isMobileDevice: this.isMobileDevice,
    });
  }

  public resolvePixelRatio(pixelRatio: number): number {
    return Math.min(
      pixelRatio,
      resolveRendererPixelRatioCap({
        graphicsSetting: this.graphicsSetting,
        isMobileDevice: this.isMobileDevice,
      }),
    );
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
    this.lastTime = runRendererAnimationTick({
      getCurrentTime: () => performance.now(),
      getCycleProgress: () => useUIStore.getState().cycleProgress || 0,
      isDestroyed: this.shouldStopAnimationLoop(),
      isLabelRuntimeReady: this.labelRuntime?.isReady() ?? false,
      lastTime: this.lastTime,
      logDestroyed: (message) => {
        if (this.isDestroyed) {
          console.log(message);
        }
      },
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

        if (rendered) {
          qualityController.recordFrame(deltaTime * 1000);
        }

        return rendered;
      },
      requestNextFrame: () =>
        requestAnimationFrame(() => {
          this.animate();
        }),
      targetFPS: this.getTargetFPS(),
      updateControls: () => {
        this.controls?.update();
      },
      updateStatsPanel: () => this.sessionRuntime.updateStatsPanel(),
    });
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
