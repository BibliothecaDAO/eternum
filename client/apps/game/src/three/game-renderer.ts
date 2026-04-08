import { useUIStore } from "@/hooks/store/use-ui-store";
import { getGameModeId } from "@/config/game-modes";
import { GUIManager } from "@/three/utils/";
import { GRAPHICS_SETTING, GraphicsSettings, IS_MOBILE } from "@/ui/config";
import { SetupResult } from "@bibliothecadao/dojo";
import { env } from "../../env";
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
import { initializeRendererBackendRuntime } from "./renderer-backend-runtime";
import { createRendererFoundationRuntime } from "./renderer-foundation-runtime";
import { runRendererFrame } from "./renderer-frame-runtime";
import type { RendererInteractionRuntime } from "./renderer-interaction-runtime";
import type { RendererLabelRuntime } from "./renderer-label-runtime";
import { qualityController } from "./utils/quality-controller";
import { prepareGameRendererScenes } from "./renderer-scene-orchestration";
import { destroyRendererRuntime } from "./renderer-destroy-runtime";
import { bootstrapRendererStartupRuntime } from "./renderer-startup-runtime";
import type { RendererSessionRuntime } from "./renderer-session-runtime";
import type { RendererSupportRuntimeRegistry } from "./renderer-support-runtime-registry";
import type { RendererBackendV2 } from "./renderer-backend-v2";
import { createGameRendererRuntimeAssembly, type GameRendererRuntimeState } from "./game-renderer-runtime-assembly";
import type { SceneManager } from "@/three/scene-manager";
import type HUDScene from "@/three/scenes/hud-scene";
import type FastTravelScene from "@/three/scenes/fast-travel";
import type HexceptionScene from "@/three/scenes/hexception";
import type WorldmapScene from "@/three/scenes/worldmap";
import type { TransitionManager } from "@/three/managers/transition-manager";

const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;
const GRAPHICS_DEV_ENABLED = env.VITE_PUBLIC_GRAPHICS_DEV;

export default class GameRenderer {
  private labelRuntime!: RendererLabelRuntime;
  private readonly sessionRuntime: RendererSessionRuntime<HUDScene>;
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

    const runtimeAssembly = createGameRendererRuntimeAssembly({
      addWindowListener: (type, listener) => window.addEventListener(type, listener),
      createFolder: (name) => trackGuiFolder(this.guiFolders, GUIManager.addFolder(name)),
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
      pixelRatio: this.getTargetPixelRatio(),
      search: window.location.search,
    });
    this.backend = backend as RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
    this.renderer = renderer;
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
    await this.backendInitializationPromise;
    if (this.isDestroyed) {
      return;
    }
    this.supportRuntimeRegistry.getControlBridge().setupGuiControls();
    this.sessionRuntime.startListeners();
    bootstrapRendererStartupRuntime({
      animate: () => this.animate(),
      attachInteractionRuntime: () => this.attachInteractionRuntime(),
      cleanupExpiredTransitions: (maxAgeMs) => transitionDB.cleanupExpired(maxAgeMs),
      debug: (message) => console.debug(message),
      document,
      initializeHudScene: () => {
        this.hudScene = this.sessionRuntime.createHudScene();
      },
      isDestroyed: this.isDestroyed,
      prepareScenes: () => this.prepareScenes(),
      registerCleanupInterval: (intervalId) => {
        this.cleanupIntervals = this.cleanupIntervals || [];
        this.cleanupIntervals.push(intervalId);
      },
      rendererDomElement: this.renderer.domElement,
      syncRouteFromLocation: () => this.sessionRuntime.syncRouteFromLocation(),
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
      isDestroyed: this.isDestroyed,
      isLabelRuntimeReady: this.labelRuntime?.isReady() ?? false,
      lastTime: this.lastTime,
      logDestroyed: (message) => console.log(message),
      renderFrame: ({ currentTime, cycleProgress, deltaTime }) =>
        runRendererFrame({
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
        }),
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
}
