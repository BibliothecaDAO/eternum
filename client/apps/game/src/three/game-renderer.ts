import { useUIStore } from "@/hooks/store/use-ui-store";
import { getGameModeId } from "@/config/game-modes";
import { TransitionManager } from "@/three/managers/transition-manager";
import { SceneManager } from "@/three/scene-manager";
import FastTravelScene from "@/three/scenes/fast-travel";
import HexceptionScene from "@/three/scenes/hexception";
import HUDScene from "@/three/scenes/hud-scene";
import WorldmapScene from "@/three/scenes/worldmap";
import { GUIManager } from "@/three/utils/";
import { GRAPHICS_SETTING, GraphicsSettings, IS_MOBILE } from "@/ui/config";
import { SetupResult } from "@bibliothecadao/dojo";
import {
  ACESFilmicToneMapping,
  CineonToneMapping,
  LinearToneMapping,
  NoToneMapping,
  ReinhardToneMapping,
  type Camera,
  type Object3D,
  type Object3DEventMap,
} from "three";
import { env } from "../../env";
import { SceneName } from "./types";
import {
  setRendererDiagnosticCapabilities,
  setRendererDiagnosticDegradations,
  syncRendererBackendDiagnostics,
} from "./renderer-diagnostics";
import { disposeRendererBackend, resizeRendererBackend } from "./renderer-backend-compat";
import { initializeSelectedRendererBackend } from "./renderer-backend-loader";
import { transitionDB } from "./utils/";
import { disposeContactShadowResources, getContactShadowResources } from "./utils/contact-shadow";
import { destroyTrackedGuiFolders, trackGuiFolder, type TrackableGuiFolder } from "./utils/gui-folder-lifecycle";
import { qualityController, type QualityFeatures } from "./utils/quality-controller";
import { createWebGLRendererBackend, type RendererBackendFactory, type RendererSurfaceLike } from "./renderer-backend";
import { createRendererEffectsRuntime, type RendererEffectsRuntime } from "./renderer-effects-runtime";
import { runRendererFrame } from "./renderer-frame-runtime";
import { createRendererInteractionRuntime, type RendererInteractionRuntime } from "./renderer-interaction-runtime";
import { createRendererLabelRuntime, type RendererLabelRuntime } from "./renderer-label-runtime";
import { createRendererMonitoringRuntime, type RendererMonitoringRuntime } from "./renderer-monitoring-runtime";
import { createRendererRouteRuntime, type RendererRouteRuntime } from "./renderer-route-runtime";
import { bootstrapRendererSceneRuntime, createRendererSceneRegistry } from "./renderer-scene-bootstrap";
import { bootstrapRendererStartupRuntime } from "./renderer-startup-runtime";
import { createWebGPURendererBackend } from "./webgpu-renderer-backend";
import type { RendererBackendV2 } from "./renderer-backend-v2";
import { requestRendererScenePrewarm } from "./webgpu-postprocess-policy";

const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;
const GRAPHICS_DEV_ENABLED = env.VITE_PUBLIC_GRAPHICS_DEV;

export default class GameRenderer {
  private labelRuntime!: RendererLabelRuntime;
  private effectsRuntime?: RendererEffectsRuntime;
  private routeRuntime?: RendererRouteRuntime;
  private backend!: RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
  private renderer!: RendererSurfaceLike;
  private interactionRuntime!: RendererInteractionRuntime;
  private camera!: RendererInteractionRuntime["camera"];
  private raycaster!: RendererInteractionRuntime["raycaster"];
  private mouse!: RendererInteractionRuntime["pointer"];
  private controls!: NonNullable<RendererInteractionRuntime["controls"]>;

  private unsubscribeQualityController?: () => void;

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
  private monitoringRuntime?: RendererMonitoringRuntime;
  private readonly isMobileDevice = IS_MOBILE;
  private backendInitializationPromise?: Promise<void>;
  private readonly handleWindowResize = () => this.onWindowResize();

  constructor(dojoContext: SetupResult) {
    this.graphicsSetting = GRAPHICS_SETTING;
    this.dojo = dojoContext;

    this.backendInitializationPromise = this.initializeRendererBackend();
    this.initializeInteractionRuntime();
    this.initializeLabelRuntime();
  }

  private initializeInteractionRuntime() {
    this.interactionRuntime = createRendererInteractionRuntime({
      graphicsSetting: this.graphicsSetting,
      onControlsChange: () => this.handleInteractionChange(),
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

  private initializeMonitoringRuntime() {
    if (this.monitoringRuntime) {
      return;
    }

    this.monitoringRuntime = createRendererMonitoringRuntime({
      debugWindow: window,
      getSceneName: () => this.sceneManager?.getCurrentScene() || "unknown",
      isGraphicsDevEnabled: !!GRAPHICS_DEV_ENABLED,
      isMemoryMonitoringEnabled: MEMORY_MONITORING_ENABLED,
      renderer: this.renderer,
      rendererOwner: this,
    });
  }

  private initializeRouteRuntime() {
    if (this.routeRuntime) {
      return;
    }

    this.routeRuntime = createRendererRouteRuntime({
      fadeIn: () => this.transitionManager?.fadeIn(),
      fastTravelEnabled: () => this.isFastTravelEnabled(),
      getCurrentScene: () => this.sceneManager?.getCurrentScene(),
      hasFastTravelScene: () => Boolean(this.fastTravelScene),
      markLabelsDirty: () => this.markLabelsDirty(),
      moveCameraForScene: () => this.sceneManager.moveCameraForScene(),
      switchScene: (sceneName) => this.sceneManager.switchScene(sceneName),
    });
  }

  private initializeEffectsRuntime() {
    if (this.effectsRuntime) {
      return;
    }

    this.effectsRuntime = createRendererEffectsRuntime({
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
    });
  }

  private handleInteractionChange() {
    this.markLabelsDirty();
    if (this.sceneManager?.getCurrentScene() === SceneName.FastTravel && this.fastTravelScene) {
      this.fastTravelScene.requestSceneRefresh();
    }
  }

  private markLabelsDirty() {
    this.labelRuntime?.markDirty();
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
    if (!this.renderer) {
      return;
    }
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
    this.initializeMonitoringRuntime();
    this.monitoringRuntime?.initialize();
  }

  // Stats Recording — delegated to StatsRecorder
  public startStatsRecording() {
    this.monitoringRuntime?.startStatsRecording();
  }

  public stopStatsRecording() {
    return this.monitoringRuntime?.stopStatsRecording() ?? [];
  }

  private captureStatsSample() {
    this.monitoringRuntime?.captureStatsSample();
  }

  public exportStatsRecording() {
    this.monitoringRuntime?.exportStatsRecording();
  }

  async initScene() {
    await this.backendInitializationPromise;
    if (this.isDestroyed) {
      return;
    }
    this.setupGUIControls();
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
    this.initializeRouteRuntime();
    this.routeRuntime?.start();
    window.addEventListener("resize", this.handleWindowResize);
  }

  private syncRouteFromLocation() {
    this.initializeRouteRuntime();
    this.routeRuntime?.syncFromLocation();
  }

  async prepareScenes() {
    this.assignRendererSceneRegistry(
      createRendererSceneRegistry({
        controls: this.controls,
        createFastTravelScene: ({ controls, dojo, mouse, raycaster, sceneManager }) =>
          new FastTravelScene(dojo, raycaster, controls, mouse, sceneManager),
        createHexceptionScene: ({ controls, dojo, mouse, raycaster, sceneManager }) =>
          new HexceptionScene(controls, dojo, mouse, raycaster, sceneManager),
        createSceneManager: (transitionManager) => new SceneManager(transitionManager),
        createTransitionManager: () => new TransitionManager(),
        createWorldmapScene: ({ controls, dojo, mouse, raycaster, sceneManager }) =>
          new WorldmapScene(dojo, raycaster, controls, mouse, sceneManager),
        dojo: this.dojo,
        fastTravelEnabled: this.isFastTravelEnabled(),
        inputSurface: this.renderer.domElement,
        mouse: this.mouse,
        raycaster: this.raycaster,
      }),
    );
    this.initializeEffectsRuntime();
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
    this.initializeEffectsRuntime();
    this.effectsRuntime?.setupPostProcessingEffects(qualityController.getFeatures());
  }

  applyEnvironment() {
    this.initializeEffectsRuntime();
    void this.effectsRuntime?.applyEnvironment();
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
    this.markLabelsDirty();
    const container = document.getElementById("three-container");
    if (container) {
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      resizeRendererBackend(this.backend, width, height);
      this.labelRuntime?.resize(width, height);
      this.hudScene.onWindowResize(width, height);
    } else {
      // Fallback to window size if container not found
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      resizeRendererBackend(this.backend, window.innerWidth, window.innerHeight);
      this.labelRuntime?.resize(window.innerWidth, window.innerHeight);
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
    const weatherManager = this.hudScene.getWeatherManager();
    if (!weatherManager) return;

    this.effectsRuntime?.updateWeatherPostProcessing(weatherManager.getState());
  }

  animate() {
    // Stop animation if renderer has been destroyed
    if (this.isDestroyed) {
      console.log("GameRenderer destroyed, stopping animation loop");
      return;
    }

    if (!this.labelRuntime?.isReady()) {
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

    this.monitoringRuntime?.updateStatsPanel();

    if (this.controls) {
      this.controls.update();
    }
    const cycleProgress = useUIStore.getState().cycleProgress || 0;
    const didRenderFrame = runRendererFrame({
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
    });

    if (!didRenderFrame) {
      requestAnimationFrame(() => {
        this.animate();
      });
      return;
    }

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

      this.disposeInteractionRuntime();

      if (this.transitionManager && typeof this.transitionManager.destroy === "function") {
        this.transitionManager.destroy();
      }

      destroyTrackedGuiFolders(this.guiFolders ?? []);

      // Remove event listeners
      window.removeEventListener("resize", this.handleWindowResize);

      this.disposeLabelRuntime();
      this.disposeMonitoringRuntime();
      this.disposeRouteRuntime();

      disposeContactShadowResources();

      console.log("GameRenderer: Destroyed and cleaned up successfully");
    } catch (error) {
      console.error("Error during GameRenderer cleanup:", error);
    }
  }

  private disposeInteractionRuntime() {
    if (this.interactionRuntime) {
      this.interactionRuntime.dispose();
      return;
    }

    this.controls?.dispose();
  }

  private disposeLabelRuntime() {
    this.labelRuntime?.dispose();
  }

  private disposeMonitoringRuntime() {
    this.monitoringRuntime?.dispose();
  }

  private disposeRouteRuntime() {
    this.routeRuntime?.dispose();
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
    this.initializeEffectsRuntime();
    this.effectsRuntime?.applyQualityFeatures(features);
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
