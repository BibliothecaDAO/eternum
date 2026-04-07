import { useUIStore } from "@/hooks/store/use-ui-store";
import { getGameModeId } from "@/config/game-modes";
import HUDScene from "@/three/scenes/hud-scene";
import { GUIManager } from "@/three/utils/";
import { GRAPHICS_SETTING, GraphicsSettings, IS_MOBILE } from "@/ui/config";
import { SetupResult } from "@bibliothecadao/dojo";
import { type Camera, type Object3D, type Object3DEventMap } from "three";
import { env } from "../../env";
import { SceneName } from "./types";
import { transitionDB } from "./utils/";
import { getContactShadowResources } from "./utils/contact-shadow";
import { trackGuiFolder, type TrackableGuiFolder } from "./utils/gui-folder-lifecycle";
import { runRendererAnimationTick } from "./renderer-animation-runtime";
import { createRendererControlBridgeRuntime } from "./renderer-control-bridge-runtime";
import { createRendererEffectsBridgeRuntime } from "./renderer-effects-bridge-runtime";
import {
  resolveRendererPixelRatioCap,
  resolveRendererTargetFps,
  resolveRendererTargetPixelRatio,
  resizeRendererDisplay,
} from "./renderer-display-runtime";
import { qualityController, type QualityFeatures } from "./utils/quality-controller";
import { type RendererBackendFactory, type RendererSurfaceLike } from "./renderer-backend";
import { initializeRendererBackendRuntime } from "./renderer-backend-runtime";
import { createRendererEffectsRuntime } from "./renderer-effects-runtime";
import { runRendererFrame } from "./renderer-frame-runtime";
import { createRendererInteractionRuntime, type RendererInteractionRuntime } from "./renderer-interaction-runtime";
import { createRendererLabelRuntime, type RendererLabelRuntime } from "./renderer-label-runtime";
import { createRendererMonitoringRuntime } from "./renderer-monitoring-runtime";
import { createRendererRouteRuntime } from "./renderer-route-runtime";
import { bootstrapRendererSceneRuntime, createGameRendererSceneRegistry } from "./renderer-scene-bootstrap";
import { destroyRendererRuntime } from "./renderer-destroy-runtime";
import { bootstrapRendererStartupRuntime } from "./renderer-startup-runtime";
import {
  createRendererSupportRuntimeRegistry,
  type RendererSupportRuntimeRegistry,
} from "./renderer-support-runtime-registry";
import type { RendererBackendV2 } from "./renderer-backend-v2";
import { requestRendererScenePrewarm } from "./webgpu-postprocess-policy";
import type { SceneManager } from "@/three/scene-manager";
import type FastTravelScene from "@/three/scenes/fast-travel";
import type HexceptionScene from "@/three/scenes/hexception";
import type WorldmapScene from "@/three/scenes/worldmap";
import type { TransitionManager } from "@/three/managers/transition-manager";

const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;
const GRAPHICS_DEV_ENABLED = env.VITE_PUBLIC_GRAPHICS_DEV;

export default class GameRenderer {
  private labelRuntime!: RendererLabelRuntime;
  private readonly supportRuntimeRegistry: RendererSupportRuntimeRegistry;
  private backend!: RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
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
  private readonly handleWindowResize = () => this.onWindowResize();

  constructor(dojoContext: SetupResult) {
    this.graphicsSetting = GRAPHICS_SETTING;
    this.dojo = dojoContext;

    this.supportRuntimeRegistry = createRendererSupportRuntimeRegistry({
      createControlBridgeRuntime: () =>
        createRendererControlBridgeRuntime({
          changeCameraView: (view) => this.worldmapScene.changeCameraView(view),
          createFolder: (name) => trackGuiFolder(this.guiFolders, GUIManager.addFolder(name)),
          fastTravelEnabled: () => this.isFastTravelEnabled(),
          getCurrentScene: () => this.sceneManager?.getCurrentScene(),
          getRenderer: () => this.renderer,
          markLabelsDirty: () => this.labelRuntime?.markDirty(),
          moveCameraToColRow: (col, row, duration) => this.worldmapScene.moveCameraToColRow(col, row, duration),
          moveCameraToXYZ: (x, y, z, duration) => this.worldmapScene.moveCameraToXYZ(x, y, z, duration),
          requestFastTravelSceneRefresh: () => this.fastTravelScene?.requestSceneRefresh(),
          switchScene: (sceneName) => this.sceneManager.switchScene(sceneName),
          updateContactShadowOpacity: (opacity) => {
            const { material } = getContactShadowResources();
            material.opacity = opacity;
          },
        }),
      createEffectsBridgeRuntime: () =>
        createRendererEffectsBridgeRuntime({
          addQualityListener: (listener) => qualityController.addEventListener(listener),
          createEffectsRuntime: () =>
            createRendererEffectsRuntime({
              backend: this.backend,
              createFolder: (name) => trackGuiFolder(this.guiFolders, GUIManager.addFolder(name)),
              graphicsSetting: this.graphicsSetting,
              isMobileDevice: this.isMobileDevice,
              resolvePixelRatio: (pixelRatio) => this.resolvePixelRatio(pixelRatio),
              scenes: {
                fastTravelScene: this.fastTravelScene,
                hexceptionScene: this.hexceptionScene,
                worldmapScene: this.worldmapScene,
              },
            }),
          resolveQualityFeatures: () => qualityController.getFeatures(),
          resolveWeatherState: () => this.hudScene?.getWeatherManager?.()?.getState(),
        }),
      createMonitoringRuntime: () =>
        createRendererMonitoringRuntime({
          debugWindow: window,
          getSceneName: () => this.sceneManager?.getCurrentScene() || "unknown",
          isGraphicsDevEnabled: !!GRAPHICS_DEV_ENABLED,
          isMemoryMonitoringEnabled: MEMORY_MONITORING_ENABLED,
          renderer: this.renderer,
          rendererOwner: this,
        }),
      createRouteRuntime: () =>
        createRendererRouteRuntime({
          fadeIn: () => this.transitionManager?.fadeIn(),
          fastTravelEnabled: () => this.isFastTravelEnabled(),
          getCurrentScene: () => this.sceneManager?.getCurrentScene(),
          hasFastTravelScene: () => Boolean(this.fastTravelScene),
          markLabelsDirty: () => this.supportRuntimeRegistry.getControlBridge().markLabelsDirty(),
          moveCameraForScene: () => this.sceneManager.moveCameraForScene(),
          switchScene: (sceneName) => this.sceneManager.switchScene(sceneName),
        }),
    });
    this.backendInitializationPromise = this.initializeRendererBackend();
    this.initializeInteractionRuntime();
    this.initializeLabelRuntime();
  }

  private initializeInteractionRuntime() {
    this.interactionRuntime = createRendererInteractionRuntime({
      graphicsSetting: this.graphicsSetting,
      onControlsChange: () => this.supportRuntimeRegistry.getControlBridge().handleInteractionChange(),
      resolveCurrentSceneName: () => this.sceneManager?.getCurrentScene(),
    });
    this.camera = this.interactionRuntime.camera;
    this.raycaster = this.interactionRuntime.raycaster;
    this.mouse = this.interactionRuntime.pointer;
  }

  private initializeLabelRuntime() {
    this.labelRuntime = createRendererLabelRuntime({
      isMobileDevice: this.isMobileDevice,
    });
    this.labelRuntime.initialize().catch((error) => {
      console.warn("GameRenderer: Failed to initialize label renderer:", error);
    });
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
      pixelRatio: this.getTargetPixelRatio(),
      search: window.location.search,
    });
    this.backend = backend as RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
    this.renderer = renderer;
  }

  initStats() {
    this.supportRuntimeRegistry.ensureMonitoring().initialize();
  }

  // Stats Recording — delegated to StatsRecorder
  public startStatsRecording() {
    this.supportRuntimeRegistry.getMonitoring()?.startStatsRecording();
  }

  public stopStatsRecording() {
    return this.supportRuntimeRegistry.getMonitoring()?.stopStatsRecording() ?? [];
  }

  private captureStatsSample() {
    this.supportRuntimeRegistry.getMonitoring()?.captureStatsSample();
  }

  public exportStatsRecording() {
    this.supportRuntimeRegistry.getMonitoring()?.exportStatsRecording();
  }

  async initScene() {
    await this.backendInitializationPromise;
    if (this.isDestroyed) {
      return;
    }
    this.supportRuntimeRegistry.getControlBridge().setupGuiControls();
    this.setupListeners();
    bootstrapRendererStartupRuntime({
      animate: () => this.animate(),
      attachInteractionRuntime: () => this.attachInteractionRuntime(),
      cleanupExpiredTransitions: (maxAgeMs) => transitionDB.cleanupExpired(maxAgeMs),
      debug: (message) => console.debug(message),
      document,
      initializeHudScene: () => this.initializeHudScene(),
      isDestroyed: this.isDestroyed,
      prepareScenes: () => {
        void this.prepareScenes();
      },
      registerCleanupInterval: (intervalId) => {
        this.cleanupIntervals = this.cleanupIntervals || [];
        this.cleanupIntervals.push(intervalId);
      },
      rendererDomElement: this.renderer.domElement,
      syncRouteFromLocation: () => this.syncRouteFromLocation(),
      warn: (message) => console.warn(message),
    });
  }

  private attachInteractionRuntime() {
    if (!this.interactionRuntime) {
      this.initializeInteractionRuntime();
    }

    this.interactionRuntime.attachSurface(this.renderer.domElement);
    if (!this.interactionRuntime.controls) {
      throw new Error("GameRenderer: Failed to attach renderer interaction runtime");
    }

    this.controls = this.interactionRuntime.controls;
  }

  private initializeHudScene() {
    this.hudScene = new HUDScene(this.sceneManager, this.controls);
  }

  private setupListeners() {
    this.supportRuntimeRegistry.ensureRoute().start();
    window.addEventListener("resize", this.handleWindowResize);
  }

  private syncRouteFromLocation() {
    this.supportRuntimeRegistry.ensureRoute().syncFromLocation();
  }

  async prepareScenes() {
    this.assignRendererSceneRegistry(
      createGameRendererSceneRegistry({
        controls: this.controls,
        dojo: this.dojo,
        fastTravelEnabled: this.isFastTravelEnabled(),
        inputSurface: this.renderer.domElement,
        mouse: this.mouse,
        raycaster: this.raycaster,
      }),
    );
    this.supportRuntimeRegistry.ensureEffectsBridge();
    bootstrapRendererSceneRuntime({
      applyEnvironment: () => this.applyEnvironment(),
      applyQualityFeatures: (features) => this.applyQualityFeatures(features),
      fastTravelScene: this.fastTravelScene,
      hexceptionScene: this.hexceptionScene,
      qualityFeatures: qualityController.getFeatures(),
      requestScenePrewarm: (scene) => {
        void this.requestScenePrewarm(scene);
      },
      sceneManager: this.sceneManager,
      setupPostProcessingEffects: () => this.setupPostProcessingEffects(),
      subscribeToQualityController: () => this.subscribeToQualityController(),
      worldmapScene: this.worldmapScene,
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

  private setupPostProcessingEffects() {
    this.supportRuntimeRegistry.ensureEffectsBridge().setupPostProcessingEffects();
  }

  applyEnvironment() {
    this.supportRuntimeRegistry.ensureEffectsBridge().applyEnvironment();
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

  /**
   * Update post-processing effects based on weather state
   * Weather modulates saturation, contrast, and vignette for atmospheric mood
   *
   * Clear: Normal values
   * Rain: Slightly desaturated, lower contrast
   * Storm: More desaturated, higher contrast, stronger vignette
   */
  private updateWeatherPostProcessing(): void {
    this.supportRuntimeRegistry.getEffectsBridge()?.updateWeatherPostProcessing();
  }

  animate() {
    this.lastTime = runRendererAnimationTick({
      getCurrentTime: () => performance.now(),
      getCycleProgress: () => useUIStore.getState().cycleProgress || 0,
      isDestroyed: this.isDestroyed,
      isLabelRuntimeReady: this.labelRuntime?.isReady() ?? false,
      lastTime: this.lastTime,
      logDestroyed: (message) => console.log(message),
      renderFrame: ({ currentTime, cycleProgress, deltaTime }) =>
        runRendererFrame({
          backend: this.backend,
          camera: this.camera,
          captureStatsSample: () => this.captureStatsSample(),
          currentScene: this.sceneManager?.getCurrentScene(),
          currentTime,
          cycleProgress,
          deltaTime,
          fastTravelScene: this.fastTravelScene,
          hexceptionScene: this.hexceptionScene,
          hudScene: this.hudScene,
          labelRuntime: this.labelRuntime,
          updateWeatherPostProcessing: () => this.updateWeatherPostProcessing(),
          worldmapScene: this.worldmapScene,
        }),
      requestNextFrame: () =>
        requestAnimationFrame(() => {
          this.animate();
        }),
      targetFPS: this.getTargetFPS(),
      updateControls: () => {
        this.controls?.update();
      },
      updateStatsPanel: () => this.supportRuntimeRegistry.getMonitoring()?.updateStatsPanel(),
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

      console.log("GameRenderer: Destroyed and cleaned up successfully");
    } catch (error) {
      console.error("Error during GameRenderer cleanup:", error);
    }
  }

  private subscribeToQualityController(): void {
    this.supportRuntimeRegistry.ensureEffectsBridge().subscribeToQualityController();
  }

  private applyQualityFeatures(features: QualityFeatures): void {
    this.supportRuntimeRegistry.ensureEffectsBridge().applyQualityFeatures(features);
  }

  private async requestScenePrewarm(
    scene:
      | {
          getCamera(): Camera;
          getScene(): Object3D<Object3DEventMap>;
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
}
